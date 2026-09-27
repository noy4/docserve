import { spawn } from "node:child_process"
import * as path from "node:path"
import * as vscode from "vscode"
import { getRunner } from "./cli"
import { DocserveState, findByDir, listLiveStates } from "./state"

const DEFAULT_PORT = 4242

let log: vscode.OutputChannel | undefined
function channel(): vscode.OutputChannel {
  return (log ??= vscode.window.createOutputChannel("docserve"))
}
export function disposeLog(): void {
  log?.dispose()
  log = undefined
}

function port(): number {
  return vscode.workspace.getConfiguration("docserve").get<number>("port") ?? DEFAULT_PORT
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type StartResult = { ok: true; state: DocserveState } | { ok: false; reason: "enoent" | "timeout" }

// Start detached via the CLI's --background mode and wait for the state file
// (written once the port is bound). Already-served folders just resolve.
export async function startServer(folder: string): Promise<StartResult> {
  const resolved = path.resolve(folder)
  const existing = findByDir(listLiveStates(), resolved)
  if (existing) return { ok: true, state: existing } // single instance per folder

  const runner = getRunner()
  const args = [...runner.args, resolved, "--background"]
  if (port() !== DEFAULT_PORT) args.push("--port", String(port()))
  channel().appendLine(`[start] ${runner.display} ${args.slice(runner.args.length).join(" ")}`)

  const child = spawn(runner.command, args, { detached: true, stdio: "ignore" })
  child.unref()
  const enoent = new Promise<boolean>((resolve) => {
    child.once("error", (err: NodeJS.ErrnoException) => resolve(err.code === "ENOENT"))
  })

  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const state = findByDir(listLiveStates(), resolved)
    if (state) return { ok: true, state }
    if (await Promise.race([enoent, delay(200)])) return { ok: false, reason: "enoent" }
  }
  return { ok: false, reason: "timeout" }
}

function runCli(args: string[]): void {
  const runner = getRunner()
  channel().appendLine(`[cli] ${runner.display} ${args.join(" ")}`)
  const child = spawn(runner.command, [...runner.args, ...args], { stdio: "ignore" })
  child.on("error", (err) => {
    channel().appendLine(`[error] ${err.message}`)
    void vscode.window.showErrorMessage(`docserve: failed to run CLI — ${err.message}`)
  })
}

export function stopServer(folder: string): void {
  runCli([path.resolve(folder), "stop"])
}

export function stopAllServers(): void {
  runCli(["stop"])
}
