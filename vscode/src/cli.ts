import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as vscode from "vscode"

export interface CliRunner {
  command: string // resolved executable
  args: string[] // package args, e.g. ["-y", "@noy4/docserve"]
  display: string // raw setting value, for logging
}

// docserve.cliCommand → executable + args. Plain `npx` may be invisible to a
// GUI-launched VS Code, so the executable is resolved against PATH and then
// common install locations (homebrew, volta, nvm) before falling back to the
// raw name and letting spawn surface the error.
export function getRunner(): CliRunner {
  const raw = vscode.workspace.getConfiguration("docserve").get<string>("cliCommand")?.trim() || "npx -y @noy4/docserve"
  const [command, ...args] = splitCommand(raw)
  return { command: resolveExecutable(command), args, display: raw }
}

function splitCommand(raw: string): string[] {
  const parts: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  for (let m = re.exec(raw); m; m = re.exec(raw))
    parts.push(m[1] ?? m[2] ?? m[3])
  return parts
}

function isExecutable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK)
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

function resolveExecutable(command: string): string {
  if (command.includes("/")) {
    const base = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
    const abs = path.isAbsolute(command) ? command : path.resolve(base, command)
    return isExecutable(abs) ? abs : command
  }
  const dirs = [...(process.env.PATH ?? "").split(path.delimiter), ...fallbackDirs()]
  for (const dir of dirs) {
    if (!dir) continue
    const file = path.join(dir, command)
    if (isExecutable(file)) return file
  }
  return command
}

function fallbackDirs(): string[] {
  const home = os.homedir()
  const dirs = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    path.join(home, ".volta/bin"), // shim dir
    path.join(home, ".asdf/shims"), // shim dir
    path.join(home, ".local/share/mise/shims"), // shim dir
    path.join(home, ".local/bin"),
  ]
  try {
    const versions = fs.readdirSync(path.join(home, ".nvm/versions/node")).sort().reverse()
    if (versions[0]) dirs.push(path.join(home, ".nvm/versions/node", versions[0], "bin"))
  } catch {
    // no nvm
  }
  return dirs
}
