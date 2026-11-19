import { spawn } from "node:child_process"
import { listLiveStates } from "../instances/state.mjs"

/**
 * @param {{ docsDir: string, port: number, open: boolean }} options
 */
export async function startBackground({ docsDir, port, open }) {
  const entry = process.argv[1]
  if (!entry) throw new Error("[docserve] Cannot locate the CLI entry for --background.")

  const childArgs = [entry, docsDir]
  if (open) childArgs.push("--open")
  childArgs.push("--port", String(port))

  const child = spawn(process.execPath, childArgs, { detached: true, stdio: "ignore" })
  child.unref()

  const state = await waitForState(child.pid)
  if (!state) throw new Error("[docserve] Server did not report startup (no state file). Try running in the foreground.")

  console.log("docserve started in the background")
  console.log(`  pid  : ${state.pid}`)
  console.log(`  url  : ${state.url}`)
  console.log(`  docs : ${state.docsDir}`)
  console.log("  stop : docserve stop")
}

/**
 * @param {number | undefined} pid
 * @param {{ timeoutMs?: number, intervalMs?: number }} [options]
 */
async function waitForState(pid, { timeoutMs = 10000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = listLiveStates().find((entry) => entry.pid === pid)
    if (state) return state
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return null
}
