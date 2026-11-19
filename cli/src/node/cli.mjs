import { exec } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import cac from "cac"
import { startBackground } from "./cli/background.mjs"
import { runServer } from "./http/server.mjs"
import { findByDir, listLiveStates, removeState } from "./instances/state.mjs"
import { PACKAGE_JSON } from "./paths.mjs"

const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"))
const VERSION = pkg.version
const DEFAULT_PORT = 4242

export async function main(argv = process.argv) {
  const cli = cac("docserve")

  cli
    .usage("[dir] [command] [options]")
    .option("--open", "Open the gallery in the browser once the port is bound")
    .option("--port <number>", `Port to bind (default: ${DEFAULT_PORT}); falls back +1 up to 20 tries`, { default: DEFAULT_PORT })
    .option("--background", "Start detached; the bound port and pid land in the state dir")
    .help()
    .version(VERSION)

  cli
    .command("[dir]", "Serve a folder of HTML files (default: current directory)")
    .usage("[dir] [options]")
    .example("docserve ~/reports --open")
    .action(async (dir, options) => {
      await startServer(dir, options)
    })

  cli
    .command("stop [dir]", "Stop the server serving [dir], or every server when [dir] is omitted")
    .action((dir) => {
      stopServer(dir)
    })

  cli
    .command("status", "List the running servers (url + docs); exit 1 if none")
    .action(() => {
      showStatus()
    })

  cli.parse(argv, { run: false })
  await cli.runMatchedCommand()
}

async function startServer(dir, options) {
  const docsDir = path.resolve(dir ?? ".")
  if (!isDirectory(docsDir))
    throw new Error(`[docserve] Directory not found: ${docsDir}`)

  const port = parsePort(options.port)
  const open = options.open ?? false

  const running = findByDir(docsDir)
  if (running) {
    if (open) openBrowser(running.url)
    console.log(`docserve is already serving this folder: ${running.url}`)
    return
  }

  if (options.background) {
    await startBackground({ docsDir, port, open })
    return
  }

  console.log(`docserve v${VERSION}`)
  console.log(`docs : ${docsDir}`)
  await runServer({ docsDir, port, open })
}

function stopServer(dir) {
  const resolved = dir ? path.resolve(dir) : null
  const states = resolved ? [findByDir(resolved)].filter(Boolean) : listLiveStates()
  if (!states.length) {
    if (resolved) throw new Error(`docserve is not serving ${resolved}.`)
    console.log("docserve is not running.")
    return
  }

  for (const state of states) {
    try {
      process.kill(state.pid, "SIGTERM")
    } catch { }
    removeState(state)
    console.log(`Stopped docserve (${state.url})`)
    console.log(`  docs : ${state.docsDir}`)
  }
}

function showStatus() {
  const states = listLiveStates()
  if (!states.length) throw new Error("docserve is not running.")
  for (const [index, state] of states.entries()) {
    if (index > 0) console.log()
    console.log(state.url)
    console.log(`docs : ${state.docsDir}`)
  }
}

function parsePort(value) {
  const port = Number(value ?? DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`[docserve] --port expects an integer between 1 and 65535, got "${value}"`)
  }
  return port
}

function openBrowser(url) {
  if (process.platform === "darwin") exec(`open ${url}`)
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory()
  } catch {
    return false
  }
}
