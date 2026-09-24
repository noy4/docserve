// Spawns the CLI and derives the tray state from the CLI's state files.
//
// The CLI writes one file per instance — ~/.cache/docserve/state/<port>-<name>.json
// {pid, port, url, docsDir} — once the port is bound and removes it on clean
// shutdown; liveness is verified with kill(pid, 0).
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"

const ROOT = path.resolve(import.meta.dirname, "..", "..")
const CACHE_ROOT = path.join(os.homedir(), ".cache", "docserve")
const STATES_DIR = process.env.DOCSERVE_STATE_DIR || path.join(CACHE_ROOT, "state")
const DESKTOP_FILE = path.join(CACHE_ROOT, "desktop.json")
const MAX_RECENT_DIRS = 5

// CLI candidates: dev layout, then the packaged asarUnpack / extraResources
// locations. Falls back to a docserve binary on PATH when none resolve.
function resolveCliEntry() {
  const candidates = [
    path.join(ROOT, "cli", "bin.mjs"),
    process.resourcesPath && path.join(process.resourcesPath, "app.asar.unpacked", "cli", "bin.mjs"),
    process.resourcesPath && path.join(process.resourcesPath, "cli", "bin.mjs"),
  ].filter(Boolean)
  return candidates.find((p) => fs.existsSync(p) && !p.includes("app.asar/")) ?? null
}

const CLI_ENTRY = resolveCliEntry()

const START_TIMEOUT_MS = 60000

export class ServerManager {
  constructor() {
    this.starting = null // { dir, timer }
    this.onChange = null
    this.onStartError = null
  }

  // Live instances, sorted by port. Any live instance clears the starting flag.
  getStates() {
    const states = readStates().filter((state) => isProcessAlive(state.pid))
    if (states.length) this.#clearStarting()
    return states
  }

  isStarting() {
    return this.starting !== null
  }

  start(dir, { open = false, silent = false } = {}) {
    if (!dir || this.starting) return
    this.starting = { dir, timer: setTimeout(() => this.#clearStarting(), START_TIMEOUT_MS) }
    this.pushRecentDir(dir)
    this.#changed()
    console.log(`[docserve-desktop] start: ${dir}${open ? " (open)" : ""}${silent ? " (silent)" : ""}`)

    const { command, args, env } = this.#cliCommand([dir, "--background", ...(open ? ["--open"] : [])])
    const child = spawn(command, args, { env, stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    child.stderr?.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-800)
    })
    child.on("exit", (code) => {
      if (code !== 0 && this.starting) {
        this.#clearStarting()
        this.#changed()
        if (silent) {
          console.warn(`[docserve-desktop] start failed: ${dir}: ${stderr.trim() || `exit code ${code}`}`)
          return
        }
        this.onStartError?.(`Failed to start the server for:\n${dir}\n\n${stderr.trim() || `exit code ${code}`}`)
      }
    })
  }

  stop() {
    console.log("[docserve-desktop] stop all")
    return this.#runCli(["stop"])
  }

  stopDir(dir) {
    console.log(`[docserve-desktop] stop: ${dir}`)
    return this.#runCli([dir, "stop"])
  }

  stopSync() {
    this.#clearStarting()
    if (this.getStates().length) {
      const { command, args, env } = this.#cliCommand(["stop"])
      spawnSync(command, args, { env, stdio: "ignore" })
    }
  }

  ensureCliSymlink() {
    const binDir = path.join(os.homedir(), ".local", "bin")
    const link = path.join(binDir, "docserve")
    try {
      if (!CLI_ENTRY) return
      fs.chmodSync(CLI_ENTRY, 0o755)
      const target = fs.realpathSync(CLI_ENTRY)
      let current = null
      try {
        current = fs.readlinkSync(link)
      } catch {}
      if (current) {
        if (path.resolve(path.dirname(link), current) === target) return
        fs.rmSync(link, { force: true })
      } else if (fs.existsSync(link)) {
        console.warn(`[docserve-desktop] ${link} exists and is not a symlink; leaving it alone.`)
        return
      }
      fs.mkdirSync(binDir, { recursive: true })
      fs.symlinkSync(target, link)
      console.log(`[docserve-desktop] CLI symlink installed: ${link} -> ${target}`)
    } catch (err) {
      console.warn(`[docserve-desktop] Could not install CLI symlink: ${err.message}`)
    }
  }

  readRecentDirs() {
    const data = readJson(DESKTOP_FILE)
    if (Array.isArray(data?.recentDirs)) return data.recentDirs.filter((d) => typeof d === "string")
    return typeof data?.lastDir === "string" ? [data.lastDir] : []
  }

  pushRecentDir(dir) {
    const dirs = [dir, ...this.readRecentDirs().filter((d) => d !== dir)].slice(0, MAX_RECENT_DIRS)
    try {
      fs.mkdirSync(CACHE_ROOT, { recursive: true })
      fs.writeFileSync(DESKTOP_FILE, JSON.stringify({ recentDirs: dirs }, null, 2) + "\n")
    } catch {}
  }

  watchPaths() {
    return [CACHE_ROOT, STATES_DIR]
  }

  #changed() {
    this.onChange?.()
  }

  #clearStarting() {
    if (this.starting?.timer) clearTimeout(this.starting.timer)
    this.starting = null
  }

  #runCli(args) {
    return new Promise((resolve) => {
      const { command, args: cliArgs, env } = this.#cliCommand(args)
      const child = spawn(command, cliArgs, { env, stdio: "ignore" })
      child.on("exit", () => {
        this.#changed()
        resolve()
      })
    })
  }

  #cliCommand(args) {
    if (CLI_ENTRY) {
      return {
        command: process.execPath,
        args: [CLI_ENTRY, ...args],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      }
    }
    return {
      command: "docserve",
      args,
      env: { ...process.env },
    }
  }
}

// Raw instance states from the state dir, sorted by port. Files with a dead
// pid are filtered by getStates(); the CLI prunes them on its own reads.
function readStates() {
  let entries = []
  try {
    entries = fs.readdirSync(STATES_DIR)
  } catch {}
  const states = []
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue
    try {
      const state = JSON.parse(fs.readFileSync(path.join(STATES_DIR, entry), "utf8"))
      if (
        typeof state?.pid === "number" &&
        typeof state?.port === "number" &&
        typeof state?.url === "string" &&
        typeof state?.docsDir === "string"
      ) {
        states.push(state)
      }
    } catch {}
  }
  return states.sort((a, b) => a.port - b.port)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
