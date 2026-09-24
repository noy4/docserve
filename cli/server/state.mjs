// Per-instance state files + pid liveness.
//
// Each server owns one file: ~/.cache/docserve/state/<port>-<name>.json
// (name = sanitized folder name), written once the port is bound and removed
// on clean shutdown. Readers verify the PID is alive and treat dead-PID state
// as stale (removed in place). DOCSERVE_STATE_DIR overrides the state dir
// (test isolation).
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

let ownFile = null // file written by this process, removed by clearState()

// DOCSERVE_STATE_DIR overrides the state dir (test isolation).
export function stateDir() {
  return process.env.DOCSERVE_STATE_DIR || path.join(os.homedir(), ".cache", "docserve", "state")
}

// <port>-<name>.json, e.g. 4242-reports.json. The port prefix keeps files
// unique (the port is exclusively bound while the server runs); the folder
// name is cosmetic. Parsing always reads the file contents, never the name.
function fileName(state) {
  const name = path
    .basename(state.docsDir)
    .replace(/[\0\\/:*?"<>|]/g, "-")
    .replace(/\p{Cc}/gu, "")
    .replace(/^\.+/, "")
    .slice(0, 40)
    .replace(/^[-.]+|[-.]+$/g, "")
  return `${state.port}-${name || "docs"}.json`
}

function readStateFile(file) {
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

export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function writeState(state) {
  fs.mkdirSync(stateDir(), { recursive: true })
  const file = path.join(stateDir(), fileName(state))
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n")
  fs.renameSync(tmp, file)
  ownFile = file
}

// Remove this process's own instance file (server shutdown).
export function clearState() {
  if (!ownFile) return
  try {
    fs.rmSync(ownFile, { force: true })
  } catch {}
  ownFile = null
}

// Remove the file of a specific instance (CLI stop).
export function removeState(state) {
  try {
    fs.rmSync(path.join(stateDir(), fileName(state)), { force: true })
  } catch {}
}

// All live instances, sorted by port. Stale files (dead pid) are pruned in
// place; unparseable files are left for inspection.
export function listLiveStates() {
  let entries = []
  try {
    entries = fs.readdirSync(stateDir())
  } catch {}
  const states = []
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue
    const file = path.join(stateDir(), entry)
    const state = readStateFile(file)
    if (!state) continue
    if (!isProcessAlive(state.pid)) {
      try {
        fs.rmSync(file, { force: true })
      } catch {}
      continue
    }
    states.push(state)
  }
  return states.sort((a, b) => a.port - b.port)
}

export function findByDir(docsDir) {
  const resolved = path.resolve(docsDir)
  return listLiveStates().find((state) => state.docsDir === resolved) ?? null
}
