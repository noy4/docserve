// state.json read/write + pid liveness.
//
// The server writes ~/.cache/docserve/state.json once the port is bound and
// removes it on clean shutdown. Readers verify the PID is alive and treat
// dead-PID state as stale (removed in place).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// DOCSERVE_STATE overrides the state file path (test isolation).
export function statePath() {
  return process.env.DOCSERVE_STATE || path.join(os.homedir(), ".cache", "docserve", "state.json");
}

export function readState() {
  try {
    const state = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    if (
      typeof state?.pid === "number" &&
      typeof state?.port === "number" &&
      typeof state?.url === "string" &&
      typeof state?.docsDir === "string"
    ) {
      return state;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeState(state) {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n");
}

export function clearState() {
  try {
    fs.rmSync(statePath(), { force: true });
  } catch {}
}

export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Read the state and drop stale entries (dead pid) in place.
export function readLiveState() {
  const state = readState();
  if (!state) return null;
  if (!isProcessAlive(state.pid)) {
    clearState();
    return null;
  }
  return state;
}
