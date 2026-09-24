#!/usr/bin/env node
// docserve — serve a folder of HTML as a card gallery with live reload.
//
//   docserve [dir] [command] [options]
//
// Flow:
//   parse args ──▶ stop / status ──▶ state files
//   └─ start
//      ├─ single-instance check (findByDir)
//      ├─ --background ──▶ spawn detached ──▶ wait for the state file
//      └─ foreground ──▶ runServer() (writes its state file on bind)
import fs from "node:fs"
import path from "node:path"
import { exec, spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { runServer } from "./server/index.mjs"
import { findByDir, listLiveStates, removeState } from "./server/state.mjs"

const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"))
const VERSION = pkg.version
const DEFAULT_PORT = 4242
const SUBCOMMANDS = ["stop", "status"]

const HELP = `
docserve v${VERSION} — serve a folder of HTML as a card gallery with live reload.

Usage:
  docserve [dir] [command] [options]

Arguments:
  dir                Folder of HTML files to serve (default: current directory)

Commands:
  stop               Stop the running docserve server
  status             Show whether a server is running (exit 1 if none)

Options:
  --open             Open the gallery in the browser once the port is bound
  --port <number>    Port to bind (default: ${DEFAULT_PORT}); falls back +1 up to 20 tries
  --background       Start detached; the bound port and pid land in the state dir
  -h, --help         Show this help
  -v, --version      Show version
`

async function main() {
  const args = parseCliArgs()
  if (args.command === "stop") return stopServer()
  if (args.command === "status") return showStatus()
  return startServer(args)
}

function parseCliArgs() {
  let parsed
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        open: { type: "boolean" },
        port: { type: "string" },
        background: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    })
  } catch (err) {
    console.error(`[docserve] ${err.message}`)
    console.error(HELP)
    process.exit(1)
  }
  if (parsed.values.help) {
    console.log(HELP)
    process.exit(0)
  }
  if (parsed.values.version) {
    console.log(VERSION)
    process.exit(0)
  }

  let dir = null
  let command = null
  for (const positional of parsed.positionals) {
    if (dir === null && command === null && SUBCOMMANDS.includes(positional)) {
      command = positional
      continue
    }
    if (dir === null) {
      dir = positional
      continue
    }
    if (command === null && SUBCOMMANDS.includes(positional)) {
      command = positional
      continue
    }
    console.error(`[docserve] Unexpected argument "${positional}".`)
    process.exit(1)
  }

  let port = DEFAULT_PORT
  if (parsed.values.port !== undefined) {
    port = Number(parsed.values.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      console.error(`[docserve] --port expects an integer between 1 and 65535, got "${parsed.values.port}"`)
      process.exit(1)
    }
  }

  return {
    dir,
    command,
    port,
    open: parsed.values.open ?? false,
    background: parsed.values.background ?? false,
  }
}

function stopServer() {
  const states = listLiveStates() // stale state (dead pid) is removed silently
  if (!states.length) {
    console.log("docserve is not running.")
    return
  }
  for (const state of states) {
    try {
      process.kill(state.pid, "SIGTERM")
    } catch {}
    removeState(state)
    console.log(`Stopped docserve (${state.url})`)
  }
}

function showStatus() {
  const states = listLiveStates()
  if (!states.length) {
    console.error("docserve is not running.")
    process.exit(1)
  }
  for (const state of states) {
    console.log(state.url)
    console.log(`docs : ${state.docsDir}`)
  }
}

async function startServer(args) {
  const docsDir = path.resolve(args.dir ?? ".")
  if (!isDirectory(docsDir)) {
    console.error(`[docserve] Directory not found: ${docsDir}`)
    process.exit(1)
  }

  // Single instance per folder: same docsDir just opens its URL; a different
  // docsDir starts its own instance (the port fallback avoids collisions).
  const running = findByDir(docsDir)
  if (running) {
    if (args.open) openBrowser(running.url)
    console.log(`docserve is already serving this folder: ${running.url}`)
    return
  }

  if (args.background) return startBackground(args, docsDir)

  console.log(`docserve v${pkg.version}`)
  console.log(`docs : ${docsDir}`)
  await runServer({ docsDir, port: args.port, open: args.open })
}

async function startBackground(args, docsDir) {
  const entry = fileURLToPath(import.meta.url)
  const childArgs = [entry, docsDir]
  if (args.open) childArgs.push("--open")
  if (args.port !== DEFAULT_PORT) childArgs.push("--port", String(args.port))
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

// Poll the state dir until the server with the given pid reports its state.
async function waitForState(pid, { timeoutMs = 10000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = listLiveStates().find((entry) => entry.pid === pid)
    if (state) return state
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return null
}

function openBrowser(url) {
  if (process.platform === "darwin") exec(`open ${url}`)
}

function isDirectory(path) {
  try {
    return fs.statSync(path).isDirectory()
  } catch {
    return false
  }
}

main().catch((err) => {
  console.error(err?.message ?? err)
  process.exit(1)
})
