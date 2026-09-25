// Spawns the CLI and derives the tray state from ~/.docserve/state files.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { dev } from "./dev.mjs"

const ROOT = path.resolve(import.meta.dirname, "..", "..")

function homeDir() {
  return process.env.DOCSERVE_HOME || path.join(os.homedir(), ".docserve")
}

function stateDir() {
  return path.join(homeDir(), "state")
}

function desktopFile() {
  return path.join(homeDir(), "desktop.json")
}

const MAX_RECENT_DIRS = 10

// CLI candidates: dev layout, packaged asarUnpack / extraResources, PATH.
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
    this.startingDirs = new Set() // dirs with a spawn in flight
    this.startTimers = new Map() // dir → START_TIMEOUT_MS guard
    this.onChange = null
    this.onStartError = null
  }

  // Live instances, sorted by port. Any live instance clears the starting flags.
  getStates() {
    const states = readStates().filter((state) => isProcessAlive(state.pid))
    if (states.length) this.#clearStartingAll()
    return states
  }

  isStarting() {
    return this.startingDirs.size > 0
  }

  start(dir, { open = false, silent = false } = {}) {
    if (!dir || this.startingDirs.has(dir)) return
    this.startingDirs.add(dir)
    this.startTimers.set(dir, setTimeout(() => this.#clearStart(dir), START_TIMEOUT_MS))
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
      const wasStarting = this.startingDirs.delete(dir)
      this.#clearStart(dir)
      if (code !== 0 && wasStarting) {
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
    this.#clearStartingAll()
    if (this.getStates().length) {
      const { command, args, env } = this.#cliCommand(["stop"])
      spawnSync(command, args, { env, stdio: "ignore" })
    }
  }

  // Called on before-quit; the next launch resumes exactly this set.
  snapshotRunningDirs() {
    const dirs = this.getStates().map((state) => state.docsDir)
    try {
      fs.mkdirSync(path.dirname(desktopFile()), { recursive: true })
      writeJsonAtomic(desktopFile(), { recentDirs: this.readRecentDirs(), resumeDirs: dirs })
    } catch { }
  }

  ensureCliSymlink() {
    // The installed app owns ~/.local/bin/docserve.
    if (dev) return
    const binDir = path.join(os.homedir(), ".local", "bin")
    const link = path.join(binDir, "docserve")
    try {
      if (!CLI_ENTRY) return
      fs.chmodSync(CLI_ENTRY, 0o755)
      const target = fs.realpathSync(CLI_ENTRY)
      let current = null
      try {
        current = fs.readlinkSync(link)
      } catch { }
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
    const data = readJson(desktopFile())
    if (Array.isArray(data?.recentDirs)) return data.recentDirs.filter((d) => typeof d === "string")
    return typeof data?.lastDir === "string" ? [data.lastDir] : []
  }

  readResumeDirs() {
    const data = readJson(desktopFile())
    return Array.isArray(data?.resumeDirs) ? data.resumeDirs.filter((d) => typeof d === "string") : null
  }

  pushRecentDir(dir) {
    const dirs = [dir, ...this.readRecentDirs().filter((d) => d !== dir)].slice(0, MAX_RECENT_DIRS)
    try {
      fs.mkdirSync(path.dirname(desktopFile()), { recursive: true })
      writeJsonAtomic(desktopFile(), { recentDirs: dirs })
    } catch { }
  }

  watchPaths() {
    return [homeDir(), stateDir()]
  }

  #changed() {
    this.onChange?.()
  }

  #clearStart(dir) {
    this.startingDirs.delete(dir)
    const timer = this.startTimers.get(dir)
    if (timer) {
      clearTimeout(timer)
      this.startTimers.delete(dir)
    }
  }

  #clearStartingAll() {
    for (const dir of [...this.startingDirs]) this.#clearStart(dir)
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

// Instance states from the state dir, sorted by port (dead pids are
// filtered by getStates()).
function readStates() {
  let entries = []
  try {
    entries = fs.readdirSync(stateDir())
  } catch { }
  const states = []
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue
    try {
      const state = JSON.parse(fs.readFileSync(path.join(stateDir(), entry), "utf8"))
      if (
        typeof state?.pid === "number" &&
        typeof state?.port === "number" &&
        typeof state?.url === "string" &&
        typeof state?.docsDir === "string"
      ) {
        states.push(state)
      }
    } catch { }
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

// Atomic write: a group-wide Ctrl+C can kill the app mid-write, leaving a truncated file.
function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n")
  fs.renameSync(tmp, file)
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
