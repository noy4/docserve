import { exec, spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import cac from "cac"
import { PACKAGE_JSON } from "./paths.mjs"
import { runServer } from "./http/server.mjs"
import { findByDir, listLiveStates, removeState } from "./instances/state.mjs"

const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"))
const VERSION = pkg.version
const DEFAULT_PORT = 4242
const SUBCOMMANDS = new Set(["stop", "status"])
const HELP_FLAGS = new Set(["-h", "--help", "-v", "--version"])

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
    .command("start [dir]", "Serve a folder of HTML files (default: current directory)")
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

  cli.parse(normalizeArgv(argv), { run: false })
  await cli.runMatchedCommand()
}

async function startServer(dir, options) {
  const docsDir = path.resolve(dir ?? ".")
  if (!isDirectory(docsDir)) {
    console.error(`[docserve] Directory not found: ${docsDir}`)
    process.exit(1)
  }

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
    if (resolved) {
      console.error(`docserve is not serving ${resolved}.`)
      process.exit(1)
    }
    console.log("docserve is not running.")
    return
  }

  for (const state of states) {
    try {
      process.kill(state.pid, "SIGTERM")
    } catch {}
    removeState(state)
    console.log(`Stopped docserve (${state.url})`)
    console.log(`  docs : ${state.docsDir}`)
  }
}

function showStatus() {
  const states = listLiveStates()
  if (!states.length) {
    console.error("docserve is not running.")
    process.exit(1)
  }
  for (const [index, state] of states.entries()) {
    if (index > 0) console.log()
    console.log(state.url)
    console.log(`docs : ${state.docsDir}`)
  }
}

async function startBackground({ docsDir, port, open }) {
  const entry = process.argv[1]
  if (!entry) {
    console.error("[docserve] Cannot locate the CLI entry for --background.")
    process.exit(1)
  }

  const childArgs = [entry, docsDir]
  if (open) childArgs.push("--open")
  if (port !== DEFAULT_PORT) childArgs.push("--port", String(port))

  const child = spawn(process.execPath, childArgs, { detached: true, stdio: "ignore" })
  child.unref()

  const state = await waitForState(child.pid)
  if (!state) {
    console.error("[docserve] Server did not report startup (no state file). Try running in the foreground.")
    process.exit(1)
  }
  console.log("docserve started in the background")
  console.log(`  pid  : ${state.pid}`)
  console.log(`  url  : ${state.url}`)
  console.log(`  docs : ${state.docsDir}`)
  console.log("  stop : docserve stop")
}

async function waitForState(pid, { timeoutMs = 10000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = listLiveStates().find((entry) => entry.pid === pid)
    if (state) return state
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return null
}

function parsePort(value) {
  const port = Number(value ?? DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`[docserve] --port expects an integer between 1 and 65535, got "${value}"`)
    process.exit(1)
  }
  return port
}

function normalizeArgv(argv) {
  const [node, bin, ...args] = argv

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--") break
    if (arg === "--port") {
      index += 1
      continue
    }
    if (arg.startsWith("--port=")) continue
    if (SUBCOMMANDS.has(arg) && index > 0) {
      args.splice(index, 1)
      args.unshift(arg)
      break
    }
  }

  let firstPositional = -1
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--") break
    if (arg === "--port") {
      index += 1
      continue
    }
    if (arg.startsWith("--port=") || arg.startsWith("-")) continue
    firstPositional = index
    break
  }

  const first = firstPositional >= 0 ? args[firstPositional] : undefined
  if (first && first !== "start" && !SUBCOMMANDS.has(first)) args.splice(firstPositional, 0, "start")
  else if (!first && !args.some((arg) => HELP_FLAGS.has(arg))) args.push("start")

  return [node, bin, ...args]
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
