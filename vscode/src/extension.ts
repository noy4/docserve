import * as os from "node:os"
import * as path from "node:path"
import * as vscode from "vscode"
import { disposeLog, startServer, stopAllServers, stopServer } from "./server"
import { DocserveState, listLiveStates, watchStateDirSetting, watchStates } from "./state"

const STATUS_IDLE = "$(play) docserve"

export function activate(context: vscode.ExtensionContext) {
  // Main item: open/start this workspace's server.
  // Adjacent $(list-unordered) item: the instance list.
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  status.command = "docserve.start"
  status.tooltip = "docserve — start server for this workspace"
  status.show()

  const listButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99)
  listButton.text = "$(list-unordered)"
  listButton.tooltip = "docserve — running servers"
  listButton.command = "docserve.list"
  listButton.show()

  context.subscriptions.push(
    status,
    listButton,
    refreshOnEvents(status),
    vscode.commands.registerCommand("docserve.start", start),
    vscode.commands.registerCommand("docserve.open", open),
    vscode.commands.registerCommand("docserve.stop", stop),
    vscode.commands.registerCommand("docserve.stopAll", stopAll),
    vscode.commands.registerCommand("docserve.list", list),
    { dispose: disposeLog },
  )
}

function refreshOnEvents(status: vscode.StatusBarItem): vscode.Disposable {
  const refresh = () => {
    const states = listLiveStates()
    const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
    const mine = folders.map((dir) => states.find((s) => s.docsDir === dir)).find(Boolean)
    if (mine) {
      status.text = `$(radio-tower) :${mine.port}`
      status.tooltip = `docserve — Open ${mine.url}`
      status.command = "docserve.open"
    } else {
      status.text = STATUS_IDLE
      status.tooltip = "docserve — start server for this workspace"
      status.command = "docserve.start"
    }
  }
  refresh()
  return vscode.Disposable.from(
    watchStates(refresh),
    watchStateDirSetting(refresh),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
  )
}

async function start(): Promise<void> {
  await pickFolder(startServerIn)
}

// Open this workspace's gallery, starting the server first if needed. Same as
// clicking the status bar item.
async function open(): Promise<void> {
  const states = listLiveStates()
  const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
  const mine = folders.map((dir) => states.find((s) => s.docsDir === dir)).find(Boolean)
  if (mine) {
    openGallery(mine)
  } else {
    await start()
  }
}

async function stop(): Promise<void> {
  const states = listLiveStates()
  if (states.length === 0) {
    void vscode.window.showInformationMessage("docserve: no servers running")
    return
  }
  const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
  const mine = folders.map((dir) => states.find((s) => s.docsDir === dir)).find(Boolean)
  const state = mine ?? (states.length === 1 ? states[0] : await pickRunningServer())
  if (state) await stopWithProgress(state)
}

async function stopAll(): Promise<void> {
  await windowProgress("docserve: stopping all servers…", stopAllServers)
}

async function list(): Promise<void> {
  const states = listLiveStates()
  if (states.length === 0) {
    void vscode.window.showInformationMessage("docserve: no servers running")
    return
  }
  const items: (vscode.QuickPickItem & { run?: () => void })[] = []
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
      run: () => void stopWithProgress(s),
    })
  }
  items.push({ kind: vscode.QuickPickItemKind.Separator, label: "actions" })
  items.push({ label: "$(folder-opened) Open Folder…", run: () => void startWithDialog() })
  items.push({ label: "$(circle-slash) Stop All", run: stopAll })
  const picked = await vscode.window.showQuickPick(items, { placeHolder: "docserve servers" })
  picked?.run?.()
}

async function startWithDialog(): Promise<void> {
  const folder = await pickAnyFolder()
  if (folder) await startServerIn(folder)
}

async function startServerIn(folder: string): Promise<void> {
  const result = await windowProgress(`docserve: starting ${path.basename(folder)}…`, () => startServer(folder))
  if (result.ok) {
    openGallery(result.state)
  } else if (result.reason === "enoent") {
    showCliMissing()
  } else {
    void vscode.window.showErrorMessage("docserve: server did not report startup (timeout)")
  }
}

async function stopWithProgress(state: DocserveState): Promise<void> {
  await windowProgress(`docserve: stopping ${path.basename(state.docsDir)}…`, () => stopServer(state.docsDir))
}

async function pickRunningServer(): Promise<DocserveState | undefined> {
  const states = listLiveStates()
  if (states.length === 0) {
    void vscode.window.showInformationMessage("docserve: no servers running")
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

function openGallery(state: DocserveState): void {
  void vscode.env.openExternal(vscode.Uri.parse(state.url))
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
  void vscode.window
    .showErrorMessage(
      "docserve: CLI not found (requires Node.js / npx). Set docserve.cliCommand if it lives elsewhere.",
      "Open Settings",
    )
    .then((pick) => {
      if (pick) void vscode.commands.executeCommand("workbench.action.openSettings", "docserve.cliCommand")
    })
}

// All long-running CLI work reports through the status bar spinner.
function windowProgress<T>(title: string, task: () => Promise<T>): Thenable<T> {
  return vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title }, task)
}

export function deactivate() { }
