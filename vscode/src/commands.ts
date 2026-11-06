import * as os from "node:os"
import * as path from "node:path"
import * as vscode from "vscode"
import { startServer, stopAllServers, stopServer } from "./server"
import { DocserveState, findByDir, listLiveStates } from "./state"

// --- Commands ---

/**
 * Open this workspace's gallery in the browser, starting the server first if
 * needed. Command-palette shortcut; the status bar item opens the servers menu.
 */
export async function open(): Promise<void> {
  const states = listLiveStates()
  const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
  const mine = folders.map((dir) => states.find((s) => s.docsDir === dir)).find(Boolean)
  if (mine) {
    openGallery(mine)
    return
  }
  await pickFolder(startServerIn)
}

/**
 * Stop this workspace's server. With multiple servers running and no match for
 * the current workspace, asks which one to stop.
 */
export async function stop(): Promise<void> {
  const states = listLiveStates()
  if (states.length === 0) {
    vscode.window.showInformationMessage("docserve: no servers running")
    return
  }
  const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
  const mine = folders.map((dir) => states.find((s) => s.docsDir === dir)).find(Boolean)
  const state = mine ?? (states.length === 1 ? states[0] : await pickRunningServer())
  if (state) await stopWithProgress(state)
}

/** Stop every server reported in the state directory. */
export async function stopAll(): Promise<void> {
  await progress({
    title: "docserve: stopping all servers…",
    task: stopAllServers,
  })
}

/**
 * Servers menu shown by the status bar item: this workspace's folder first
 * (open, or start-and-open), then each running server, then actions.
 */
export async function list(): Promise<void> {
  const states = listLiveStates()
  const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
  const mine = folders.map((dir) => states.find((s) => s.docsDir === dir)).find(Boolean)

  const items: (vscode.QuickPickItem & { run?: () => void })[] = []

  if (mine) {
    items.push({
      label: "$(link-external) Open Workspace Gallery",
      description: mine.url,
      run: () => openGallery(mine),
    })
    items.push({
      label: "$(stop-circle) Stop Workspace Server",
      run: () => stopWithProgress(mine),
    })
  } else if (folders.length > 0) {
    items.push({
      label: "$(play) Start & Open Workspace Gallery",
      description: folders.length === 1 ? tildify(folders[0]) : "choose folder…",
      run: () => pickFolder(startServerIn),
    })
  }

  if (states.length > 0) {
    items.push({ kind: vscode.QuickPickItemKind.Separator, label: "servers" })
    for (const s of states) {
      items.push({
        label: `$(link-external) Open ${serverLabel(s)}`,
        description: s.url,
        run: () => openGallery(s),
      })
    }
    items.push({ kind: vscode.QuickPickItemKind.Separator, label: "stop" })
    for (const s of states) {
      items.push({
        label: `$(stop-circle) Stop ${serverLabel(s)}`,
        run: () => stopWithProgress(s),
      })
    }
  }

  const actions: (vscode.QuickPickItem & { run?: () => void })[] = [
    { label: "$(folder-opened) Open Folder…", run: () => openFolder() },
  ]
  if (states.length > 0) actions.push({ label: "$(circle-slash) Stop All", run: stopAll })
  if (items.length > 0) items.push({ kind: vscode.QuickPickItemKind.Separator, label: "actions" })
  items.push(...actions)

  const picked = await vscode.window.showQuickPick(items, { placeHolder: "docserve" })
  picked?.run?.()
}

// --- Actions ---

/** Open a folder picker, then start and open the gallery in that folder. */
export async function openFolder(): Promise<void> {
  const folder = await pickAnyFolder()
  if (folder) await startServerIn(folder)
}

/**
 * "Open with Docserve" — the explorer/editor-file analogue of Live Server.
 * Serves the workspace folder that holds the file (its own folder outside a
 * workspace) and opens that file's URL, starting the server first if needed.
 */
export async function openFile(uri?: vscode.Uri): Promise<void> {
  const file = targetFile(uri)
  if (!file || !/\.html?$/i.test(file)) {
    vscode.window.showInformationMessage("docserve: right-click an HTML file to open it with docserve")
    return
  }
  const root = serveRoot(file)
  const state = await ensureServer(root)
  if (!state) return
  const url = new URL(toUrlPath(path.relative(root, file)), state.url).toString()
  vscode.env.openExternal(vscode.Uri.parse(url))
}

async function startServerIn(folder: string): Promise<void> {
  const state = await ensureServer(folder)
  if (state) openGallery(state)
}

/** Reuse the running server for this folder, or start one and wait for its state. */
async function ensureServer(folder: string): Promise<DocserveState | undefined> {
  const existing = findByDir(listLiveStates(), folder)
  if (existing) return existing

  const result = await progress({
    title: `docserve: starting ${path.basename(folder)}…`,
    task: () => startServer(folder),
  })
  if (result.ok) return result.state
  if (result.reason === "enoent") showCliMissing()
  else vscode.window.showErrorMessage("docserve: server did not report startup (timeout)")
  return undefined
}

async function stopWithProgress(state: DocserveState): Promise<void> {
  await progress({
    title: `docserve: stopping ${path.basename(state.docsDir)}…`,
    task: () => stopServer(state.docsDir),
  })
}

// --- Pickers ---

async function pickRunningServer(): Promise<DocserveState | undefined> {
  const states = listLiveStates()
  if (states.length === 0) {
    vscode.window.showInformationMessage("docserve: no servers running")
    return undefined
  }
  if (states.length === 1) return states[0]
  return vscode.window
    .showQuickPick(
      states.map((s) => ({ label: `$(radio-tower) ${serverLabel(s)}`, detail: s.url, state: s })),
      { placeHolder: "Which server?" },
    )
    .then((picked) => picked?.state)
}

function pickFolder(run: (folder: string) => Promise<void>): Promise<void> {
  return (async () => {
    const folders = vscode.workspace.workspaceFolders
    let folder: string | undefined
    if (!folders || folders.length === 0) {
      folder = await pickAnyFolder()
    } else if (folders.length === 1) {
      folder = folders[0].uri.fsPath
    } else {
      folder = await vscode.window.showQuickPick(folders.map((f) => f.uri.fsPath), { placeHolder: "Which folder?" })
    }
    if (folder) await run(folder)
  })()
}

async function pickAnyFolder(): Promise<string | undefined> {
  const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false })
  return picked?.[0]?.fsPath
}

// --- Helpers ---

function openGallery(state: DocserveState): void {
  vscode.env.openExternal(vscode.Uri.parse(state.url))
}

// The file the command targets: an explorer/editor URI, else the active editor.
function targetFile(uri?: vscode.Uri): string | undefined {
  if (uri?.scheme === "file") return uri.fsPath
  const active = vscode.window.activeTextEditor?.document.uri
  return active?.scheme === "file" ? active.fsPath : undefined
}

// Serve the innermost workspace folder that contains the file, else its folder.
function serveRoot(file: string): string {
  const owner = (vscode.workspace.workspaceFolders ?? [])
    .map((f) => path.resolve(f.uri.fsPath))
    .filter((dir) => isInside(dir, file))
    .sort((a, b) => b.length - a.length)[0]
  return owner ?? path.dirname(file)
}

function isInside(dir: string, file: string): boolean {
  const rel = path.relative(dir, file)
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)
}

// docsDir-relative path → URL path: forward slashes, percent-encoded segments.
function toUrlPath(relative: string): string {
  return relative.split(path.sep).map(encodeURIComponent).join("/")
}

// "reports (~/repos/research)" — same shape as the desktop tray menu
function serverLabel(state: DocserveState): string {
  return `${path.basename(state.docsDir)} (${tildify(path.dirname(state.docsDir))})`
}

function tildify(p: string): string {
  const home = os.homedir()
  return p.startsWith(home) ? `~${p.slice(home.length)}` : p
}

function showCliMissing(): void {
  vscode.window
    .showErrorMessage(
      "docserve: CLI not found (requires Node.js / npx). Set docserve.cliCommand if it lives elsewhere.",
      "Open Settings",
    )
    .then((pick) => {
      if (pick) vscode.commands.executeCommand("workbench.action.openSettings", "docserve.cliCommand")
    })
}

// All long-running CLI work reports through the status bar spinner.
function progress<T>(options: { title: string; task: () => Promise<T> }): Thenable<T> {
  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Window,
    title: options.title,
  }, options.task)
}
