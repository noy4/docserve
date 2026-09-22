// End-to-end tests for the docserve server: spawn cli/bin.mjs against temp
// folders and exercise injection, the /__reload broadcast, HTTP status codes,
// and the CLI lifecycle.
//
// Isolation: a random --port per run and DOCSERVE_STATE pointing at a temp
// state file keep runs parallel-safe.
import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const CLI = join(dirname(fileURLToPath(import.meta.url)), "bin.mjs")
const PORT = 20000 + Math.floor(Math.random() * 20000)
const WS_PATH = "/__reload"
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Resolve once the server reports its bound port via state.json.
async function waitForState(stateFile, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      const state = JSON.parse(readFileSync(stateFile, "utf8"))
      if (typeof state.port === "number") return state
    } catch {}
    await delay(100)
  }
  throw new Error("server did not write its state file")
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
  let stateDir
  let otherDir
  let env

  before(async () => {
    content = mkdtempSync(join(tmpdir(), "docserve-content-"))
    stateDir = mkdtempSync(join(tmpdir(), "docserve-state-"))
    otherDir = mkdtempSync(join(tmpdir(), "docserve-other-"))
    env = { ...process.env, DOCSERVE_STATE: join(stateDir, "state.json") }
    child = spawn(process.execPath, [CLI, content, "--port", String(PORT)], { stdio: "ignore", env })
    const state = await waitForState(env.DOCSERVE_STATE)
    port = state.port
  })

  after(() => {
    child?.kill("SIGTERM")
    for (const dir of [content, stateDir, otherDir]) rmSync(dir, { recursive: true, force: true })
  })

  it("injects a reload client with a per-file page ID", async () => {
    writeFileSync(join(content, "page.html"), "<html><body></body></html>")
    const page = await (await fetch(`http://localhost:${port}/page.html`)).text()
    assert.ok(page.includes('const pageId = "page.html"'))
    assert.ok(page.includes(WS_PATH))
    assert.ok(page.includes("window.self !== window.top"), "iframe previews get no client")

    writeFileSync(join(content, "+special.html"), "<html><body>Endpoint is /__reload</body></html>")
    const special = await (await fetch(`http://localhost:${port}/%2Bspecial.html`)).text()
    assert.ok(special.includes('const pageId = "+special.html"'))
  })

  it("serves the gallery template, not injected", async () => {
    const gallery = await (await fetch(`http://localhost:${port}/`)).text()
    assert.ok(gallery.includes("contentSetChanged"), "gallery ships its own reload client")
    assert.ok(gallery.includes(content), "docsDir is substituted")
    assert.ok(!gallery.includes("const pageId"))
    assert.ok(!gallery.includes("__DOCSERVE_DIR__"))
  })

  it("lists html files with resolved metadata on /api/files", async () => {
    const files = await (await fetch(`http://localhost:${port}/api/files`)).json()
    assert.ok(Array.isArray(files))
    const page = files.find((f) => f.path.endsWith("page.html"))
    assert.ok(page)
    assert.deepEqual(Object.keys(page).sort(), ["created", "modified", "path", "title", "url"])
    assert.equal(page.url, "/page.html")
    assert.equal(page.title, "page.html", "title falls back to the file name")
    assert.equal(typeof page.created, "number")
    assert.equal(typeof page.modified, "number")
  })

  it("answers 403, 400 and 404 for bad paths", async () => {
    assert.equal((await fetch(`http://localhost:${port}/..%2F..%2Fetc%2Fpasswd`)).status, 403)
    assert.equal((await fetch(`http://localhost:${port}/%zz`)).status, 400)
    assert.equal((await fetch(`http://localhost:${port}/missing.html`)).status, 404)
  })

  it("targets only the page whose file changed", async () => {
    mkdirSync(join(content, "nested"))
    const changed = join(content, "nested/changed.html")
    writeFileSync(changed, "<html>before</html>")
    writeFileSync(join(content, "nested/untouched.html"), "<html>before</html>")
    await delay(150)

    const ws = new WebSocket(`ws://localhost:${port}${WS_PATH}`)
    await once(ws, "open")
    try {
      writeFileSync(changed, "<html>after</html>")
      const change = await waitForChange(ws, (c) => c.pages.includes("nested/changed.html"))
      assert.deepEqual(change, { type: "change", pages: ["nested/changed.html"], contentSetChanged: false })
    } finally {
      ws.close()
    }
  })

  it("flags content additions and removals for a gallery reload", async () => {
    const ws = new WebSocket(`ws://localhost:${port}${WS_PATH}`)
    await once(ws, "open")
    const file = join(content, ".tmp-gallery-add.html")
    try {
      writeFileSync(file, "<html></html>")
      assert.deepEqual(await waitForChange(ws, (c) => c.contentSetChanged), {
        type: "change",
        pages: [".tmp-gallery-add.html"],
        contentSetChanged: true,
      })

      writeFileSync(file, "<html>edited</html>")
      assert.deepEqual(await waitForChange(ws, (c) => c.pages.includes(".tmp-gallery-add.html")), {
        type: "change",
        pages: [".tmp-gallery-add.html"],
        contentSetChanged: false,
      })

      rmSync(file)
      assert.deepEqual(await waitForChange(ws, (c) => c.contentSetChanged), {
        type: "change",
        pages: [".tmp-gallery-add.html"],
        contentSetChanged: true,
      })
    } finally {
      rmSync(file, { force: true })
      ws.close()
    }
  })

  // Runs last: it stops the server under test.
  it("enforces the single-instance rule and the stop/status lifecycle", () => {
    const status = spawnSync(process.execPath, [CLI, "status"], { env, encoding: "utf8" })
    assert.equal(status.status, 0)
    assert.match(status.stdout, /localhost:\d+/)

    const other = spawnSync(process.execPath, [CLI, otherDir], { env, encoding: "utf8" })
    assert.equal(other.status, 1)
    assert.match(other.stderr, /already running/)

    const stop = spawnSync(process.execPath, [CLI, "stop"], { env, encoding: "utf8" })
    assert.equal(stop.status, 0)
    assert.equal(spawnSync(process.execPath, [CLI, "status"], { env, encoding: "utf8" }).status, 1)
  })
})
