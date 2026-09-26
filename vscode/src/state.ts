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

// Same semantics as the CLI: DOCSERVE_HOME replaces ~/.docserve, and the
// state dir lives directly under it. docserve.stateDir mirrors the override.
export function stateDir(): string {
  const override = vscode.workspace.getConfiguration("docserve").get<string>("stateDir")?.trim()
  const home = override || path.join(os.homedir(), ".docserve")
  return path.join(home, "state")
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

// Live instances sorted by port. Stale entries (dead pid) are skipped here —
// pruning them is the CLI's job; the extension is a read-only client.
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

// fs.watch on the state dir plus a 5s poll as a safety net; changes are
// debounced so a burst of writes triggers one refresh.
export function watchStates(onChange: () => void): vscode.Disposable {
  let timer: NodeJS.Timeout | undefined
  const notify = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 100)
  }

  let watcher: fs.FSWatcher | undefined
  try {
    watcher = fs.watch(stateDir(), notify)
  } catch {
    // state dir may not exist yet (no server ever ran); the poll covers it
  }

  const poll = setInterval(notify, 5000)
  return new vscode.Disposable(() => {
    watcher?.close()
    clearInterval(poll)
    clearTimeout(timer)
  })
}

// Recreate the watcher when the state dir override changes.
export function watchStateDirSetting(onChange: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("docserve.stateDir")) onChange()
  })
}
