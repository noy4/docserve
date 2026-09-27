import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as vscode from "vscode"

export interface DocserveState {
  pid: number
  port: number
  url: string
  docsDir: string
}

// Same as the CLI: <DOCSERVE_HOME | ~/.docserve>/state.
export function stateDir(): string {
  const override = vscode.workspace.getConfiguration("docserve").get<string>("stateDir")?.trim()
  return stateDirPath(os.homedir(), override)
}

// Pure counterpart of stateDir() for tests.
export function stateDirPath(home: string, override?: string): string {
  return path.join(override || path.join(home, ".docserve"), "state")
}

function readStateFile(file: string): DocserveState | null {
  try {
    const state = JSON.parse(fs.readFileSync(file, "utf8"))
    if (
      typeof state?.pid === "number" &&
      typeof state?.port === "number" &&
      typeof state?.url === "string" &&
      typeof state?.docsDir === "string"
    ) {
      return state
    }
    return null
  } catch {
    return null
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Live instances sorted by port. Stale entries (dead pid) are skipped —
// pruning is the CLI's job; the extension is a read-only client.
export function listLiveStates(): DocserveState[] {
  let entries: string[] = []
  try {
    entries = fs.readdirSync(stateDir())
  } catch {
    return []
  }
  const states: DocserveState[] = []
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue
    const state = readStateFile(path.join(stateDir(), entry))
    if (state && isProcessAlive(state.pid)) states.push(state)
  }
  return states.sort((a, b) => a.port - b.port)
}

export function findByDir(states: DocserveState[], docsDir: string): DocserveState | undefined {
  const resolved = path.resolve(docsDir)
  return states.find((state) => state.docsDir === resolved)
}

// fs.watch + 5s poll as a safety net, debounced. The watcher re-arms once
// the dir appears or is recreated.
export function watchStates(onChange: () => void): vscode.Disposable {
  let timer: NodeJS.Timeout | undefined
  let watcher: fs.FSWatcher | undefined

  const notify = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 100)
  }

  const ensureWatcher = () => {
    if (watcher) return
    try {
      watcher = fs.watch(stateDir(), notify)
      watcher.on("error", () => {
        watcher?.close()
        watcher = undefined
      })
    } catch {
      // dir not there yet; the poll re-arms
    }
  }

  ensureWatcher()
  const poll = setInterval(() => {
    ensureWatcher()
    notify()
  }, 5000)

  return new vscode.Disposable(() => {
    watcher?.close()
    clearInterval(poll)
    clearTimeout(timer)
  })
}

// Re-run onChange when docserve.stateDir changes.
export function watchStateDirSetting(onChange: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("docserve.stateDir")) onChange()
  })
}
