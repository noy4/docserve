// End-to-end tests for the docserve server: spawn cli/bin.mjs against temp
// folders and exercise injection, the /__reload broadcast, HTTP status codes,
// and the CLI lifecycle.
//
// Isolation: a random --port per run and DOCSERVE_HOME pointing at a temp
// docserve home keep runs parallel-safe.
import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import { existsSync, readFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { runServer } from "./server/index.mjs"
import { listHtmlFiles, shouldIgnore } from "./server/files.mjs"

const CLI = join(dirname(fileURLToPath(import.meta.url)), "bin.mjs")
const PORT = 20000 + Math.floor(Math.random() * 20000)
const WS_PATH = "/__reload"
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Resolve once the server reports its bound port via a state file in the dir.
async function waitForState(stateDir, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      for (const entry of readdirSync(stateDir)) {
        if (!entry.endsWith(".json")) continue
        const state = JSON.parse(readFileSync(join(stateDir, entry), "utf8"))
        if (typeof state.port === "number") return state
      }
    } catch {}
    await delay(100)
  }
  throw new Error("server did not write its state file")
}

// Resolve once at least `count` state files exist in the dir.
async function waitForStates(stateDir, count, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      const states = readdirSync(stateDir)
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => JSON.parse(readFileSync(join(stateDir, entry), "utf8")))
        .filter((state) => typeof state.port === "number")
      if (states.length >= count) return states
    } catch {}
    await delay(100)
  }
  throw new Error(`expected ${count} state files`)
}

// Resolve once the port refuses connections (the server is gone).
async function assertDown(port, timeoutMs = 3000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      await fetch(`http://localhost:${port}/`)
      await delay(100)
    } catch {
      return
    }
  }
  throw new Error(`server on port ${port} is still up`)
}

// Resolve with the next change message matching the predicate; others are skipped.
function waitForChange(ws, match, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for change")), timeoutMs)
    ws.addEventListener("message", function onMessage(e) {
      let change
      try { change = JSON.parse(e.data) } catch { return }
      if (change?.type === "change" && match(change)) {
        clearTimeout(timer)
        ws.removeEventListener("message", onMessage)
        resolve(change)
      }
    })
    ws.addEventListener("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

describe("docserve server", () => {
  let child
  let port
  let content
  let home
  let otherDir
  let env

  before(async () => {
    content = mkdtempSync(join(tmpdir(), "docserve-content-"))
    home = mkdtempSync(join(tmpdir(), "docserve-home-"))
    otherDir = mkdtempSync(join(tmpdir(), "docserve-other-"))
    env = { ...process.env, DOCSERVE_HOME: home }
    child = spawn(process.execPath, [CLI, content, "--port", String(PORT)], { stdio: "ignore", env })
    const state = await waitForState(join(home, "state"))
    port = state.port
  })

  after(() => {
    child?.kill("SIGTERM")
    for (const dir of [content, home, otherDir]) rmSync(dir, { recursive: true, force: true })
  })

  it("injects a reload client with a per-file page ID", async () => {
    writeFileSync(join(content, "page.html"), "<html><body></body></html>")
    const page = await (await fetch(`http://localhost:${port}/page.html`)).text()
    assert.ok(page.includes('const pageId = "page.html"'))
    assert.ok(page.includes(`const absPath = ${JSON.stringify(join(content, "page.html"))}`))
    assert.ok(page.includes(WS_PATH))
    assert.ok(!page.includes("__DOCSERVE_"), "all injection template markers are substituted")
    assert.ok(page.includes("window.self !== window.top"), "iframe previews get no client")
  })

  it("serves the gallery template, not injected", async () => {
    const gallery = await (await fetch(`http://localhost:${port}/`)).text()
    assert.ok(gallery.includes("contentSetChanged"), "gallery ships its own reload client")
    assert.ok(gallery.includes(content), "docsDir is substituted")
    assert.ok(gallery.includes(`<title>${basename(content)}</title>`), "gallery title uses the folder name")
    assert.ok(gallery.includes(`    ${basename(content)}\n  </h1>`), "gallery heading uses the folder name")
    assert.ok(!gallery.includes("const pageId"))
    assert.ok(!gallery.includes("__DOCS_DIR"))
  })

  it("lists html files with resolved metadata on /api/files", async () => {
    writeFileSync(join(content, "favicon.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>")
    writeFileSync(join(content, "fav.html"), '<html><head><link rel="icon" href="favicon.svg"><title>Fav</title></head></html>')
    writeFileSync(join(content, "escaping.html"), '<html><head><link rel="icon" href="../outside.png"></head></html>')

    const files = await (await fetch(`http://localhost:${port}/api/files`)).json()
    assert.ok(Array.isArray(files))
    const page = files.find((f) => f.path.endsWith("page.html"))
    assert.ok(page)
    assert.deepEqual(Object.keys(page).sort(), ["created", "modified", "path", "title", "url"], "no favicon key when unset")
    assert.equal(page.url, "/page.html")
    assert.equal(page.title, "page.html", "title falls back to the file name")
    assert.equal(typeof page.created, "number")
    assert.equal(typeof page.modified, "number")

    const fav = files.find((f) => f.path.endsWith("fav.html"))
    assert.equal(fav.favicon, "/favicon.svg", "relative href resolves against the page URL")
    assert.equal(files.find((f) => f.path.endsWith("escaping.html")).favicon, undefined, "hrefs escaping docsDir are dropped")
  })

  it("answers 403, 400 and 404 for bad paths", async () => {
    assert.equal((await fetch(`http://localhost:${port}/..%2F..%2Fetc%2Fpasswd`)).status, 403)
    assert.equal((await fetch(`http://localhost:${port}/%zz`)).status, 400)
    assert.equal((await fetch(`http://localhost:${port}/missing.html`)).status, 404)
  })

  it("targets only the page whose file changed", async () => {
    mkdirSync(join(content, "nested"), { recursive: true })
    const changed = join(content, "nested/changed.html")
    writeFileSync(changed, "<html>before</html>")
    writeFileSync(join(content, "nested/untouched.html"), "<html>before</html>")
    await delay(150)

    const ws = new WebSocket(`ws://localhost:${port}${WS_PATH}`)
    await once(ws, "open")
    try {
      writeFileSync(changed, "<html>after</html>")
      const change = await waitForChange(ws, (c) => c.pages.includes("nested/changed.html"))
      assert.deepEqual(change, {
        type: "change",
        pages: ["nested/changed.html"],
        contentSetChanged: false,
        templateChanged: false,
      })
    } finally {
      ws.close()
    }
  })

  it("flags content additions and removals for a gallery reload", async () => {
    const ws = new WebSocket(`ws://localhost:${port}${WS_PATH}`)
    await once(ws, "open")
    const file = join(content, "tmp-gallery-add.html")
    try {
      writeFileSync(file, "<html></html>")
      assert.deepEqual(await waitForChange(ws, (c) => c.contentSetChanged), {
        type: "change",
        pages: ["tmp-gallery-add.html"],
        contentSetChanged: true,
        templateChanged: false,
      })

      rmSync(file)
      assert.deepEqual(await waitForChange(ws, (c) => c.contentSetChanged), {
        type: "change",
        pages: ["tmp-gallery-add.html"],
        contentSetChanged: true,
        templateChanged: false,
      })
    } finally {
      rmSync(file, { force: true })
      ws.close()
    }
  })

  // Runs last: it stops the server under test.
  it("points at the running server for the same folder and stops it", () => {
    const status = spawnSync(process.execPath, [CLI, "status"], { env, encoding: "utf8" })
    assert.equal(status.status, 0)
    assert.match(status.stdout, /localhost:\d+/)

    const same = spawnSync(process.execPath, [CLI, content], { env, encoding: "utf8" })
    assert.equal(same.status, 0)
    assert.match(same.stdout, /already serving this folder/)

    const stop = spawnSync(process.execPath, [CLI, "stop"], { env, encoding: "utf8" })
    assert.equal(stop.status, 0)
    assert.equal(spawnSync(process.execPath, [CLI, "status"], { env, encoding: "utf8" }).status, 1)
  })

  it("gracefully shuts down by closing active sockets and releasing the port", async () => {
    const testDir = mkdtempSync(join(tmpdir(), "docserve-graceful-"))
    const testPort = 35000 + Math.floor(Math.random() * 10000)
    const { server, wss, close } = await runServer({ docsDir: testDir, port: testPort })
    const ws = new WebSocket(`ws://localhost:${testPort}/__reload`)
    await once(ws, "open")
    assert.equal(wss.clients.size, 1)

    close()
    await assertDown(testPort)
    assert.equal(wss.clients.size, 0)
    rmSync(testDir, { recursive: true, force: true })
  })

  it("ignores hidden files and directories, and node_modules", async () => {
    assert.equal(shouldIgnore(".git/HEAD"), true)
    assert.equal(shouldIgnore("sub/.git/config"), true)
    assert.equal(shouldIgnore("node_modules/pkg/index.html"), true)
    assert.equal(shouldIgnore("sub/node_modules/pkg/index.html"), true)
    assert.equal(shouldIgnore(".DS_Store"), true)
    assert.equal(shouldIgnore(".draft.html"), true)
    assert.equal(shouldIgnore("sub/.draft.html"), true)
    assert.equal(shouldIgnore("valid.html"), false)
    assert.equal(shouldIgnore("sub/valid.html"), false)

    const testDir = mkdtempSync(join(tmpdir(), "docserve-ignore-"))
    try {
      mkdirSync(join(testDir, ".git"), { recursive: true })
      mkdirSync(join(testDir, "node_modules", "pkg"), { recursive: true })
      mkdirSync(join(testDir, "sub"), { recursive: true })

      writeFileSync(join(testDir, "index.html"), "<html></html>")
      writeFileSync(join(testDir, ".git", "hidden.html"), "<html></html>")
      writeFileSync(join(testDir, ".draft.html"), "<html></html>")
      writeFileSync(join(testDir, "node_modules", "pkg", "vendor.html"), "<html></html>")
      writeFileSync(join(testDir, "sub", "ok.html"), "<html></html>")
      writeFileSync(join(testDir, "sub", "index.html"), "<html></html>")

      const files = await listHtmlFiles(testDir)
      assert.equal(files.length, 2)
      assert.ok(files.some((file) => file.endsWith("sub/ok.html") || file.endsWith("sub\\ok.html")))
      assert.ok(files.some((file) => file.endsWith("sub/index.html") || file.endsWith("sub\\index.html")))
    } finally {
      rmSync(testDir, { recursive: true, force: true })
    }
  })
})

describe("docserve multi-instance", () => {
  let home
  let dirA
  let dirB
  let env
  let childA
  let childB
  let portA
  let portB

  before(async () => {
    dirA = mkdtempSync(join(tmpdir(), "docserve-multi-a-"))
    dirB = mkdtempSync(join(tmpdir(), "docserve-multi-b-"))
    home = mkdtempSync(join(tmpdir(), "docserve-multi-home-"))
    writeFileSync(join(dirA, "a.html"), "<html><body>A</body></html>")
    writeFileSync(join(dirB, "b.html"), "<html><body>B</body></html>")
    env = { ...process.env, DOCSERVE_HOME: home }
    // Same requested port for both: the second one must fall back +1.
    childA = spawn(process.execPath, [CLI, dirA, "--port", String(PORT)], { stdio: "ignore", env })
    childB = spawn(process.execPath, [CLI, dirB, "--port", String(PORT)], { stdio: "ignore", env })
    const states = await waitForStates(join(home, "state"), 2)
    portA = states.find((state) => state.docsDir === dirA).port
    portB = states.find((state) => state.docsDir === dirB).port
  })

  after(() => {
    childA?.kill("SIGTERM")
    childB?.kill("SIGTERM")
    for (const dir of [dirA, dirB, home]) rmSync(dir, { recursive: true, force: true })
  })

  it("serves two folders concurrently on distinct ports", async () => {
    assert.notEqual(portA, portB, "port fallback gives the second folder its own port")
    const a = await (await fetch(`http://localhost:${portA}/a.html`)).text()
    const b = await (await fetch(`http://localhost:${portB}/b.html`)).text()
    assert.ok(a.includes("<body>A"), "folder A serves its own page")
    assert.ok(b.includes("<body>B"), "folder B serves its own page")
  })

  it("keeps reload broadcasts per folder", async () => {
    const wsA = new WebSocket(`ws://localhost:${portA}${WS_PATH}`)
    const wsB = new WebSocket(`ws://localhost:${portB}${WS_PATH}`)
    await once(wsA, "open")
    await once(wsB, "open")
    try {
      // Folder B must stay quiet: a timeout there is the expected outcome.
      const quietB = waitForChange(wsB, () => true, 700).then(
        () => {
          throw new Error("folder B received folder A's change")
        },
        (err) => {
          if (!/timeout/.test(err.message)) throw err
        },
      )
      writeFileSync(join(dirA, "a.html"), "<html><body>A2</body></html>")
      const change = await waitForChange(wsA, (c) => c.pages.includes("a.html"))
      assert.deepEqual(change.pages, ["a.html"])
      await quietB
    } finally {
      wsA.close()
      wsB.close()
    }
  })

  // Runs last: it stops the remaining server under test.
  it("stops one folder without touching the other, then stops all", async () => {
    const stop = spawnSync(process.execPath, [CLI, dirA, "stop"], { env, encoding: "utf8" })
    assert.equal(stop.status, 0)
    await assertDown(portA)
    const b = await (await fetch(`http://localhost:${portB}/b.html`)).text()
    assert.ok(b.includes("<body>B"), "the other folder keeps serving")

    const status = spawnSync(process.execPath, [CLI, "status"], { env, encoding: "utf8" })
    assert.equal(status.status, 0)
    assert.match(status.stdout, new RegExp(`localhost:${portB}`))
    assert.doesNotMatch(status.stdout, new RegExp(`localhost:${portA}`))

    const stopAll = spawnSync(process.execPath, [CLI, "stop"], { env, encoding: "utf8" })
    assert.equal(stopAll.status, 0)
    assert.match(stopAll.stdout, new RegExp(`localhost:${portB}`))
    await assertDown(portB)
    assert.equal(spawnSync(process.execPath, [CLI, "status"], { env, encoding: "utf8" }).status, 1)
  })

  it("prunes stale instance files with dead pids", () => {
    const stale = join(home, "state", "99999-stale.json")
    writeFileSync(
      stale,
      JSON.stringify({ pid: 999999999, port: 99999, url: "http://localhost:99999/", docsDir: "/gone" }),
    )
    const status = spawnSync(process.execPath, [CLI, "status"], { env, encoding: "utf8" })
    assert.equal(status.status, 1, "no live instances left")
    assert.ok(!existsSync(stale), "the stale file was pruned in place")
  })
})
