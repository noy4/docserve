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
    vscode.commands.registerCommand("docserve.openCurrent", openCurrent),
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
      status.tooltip = `docserve\nOpen ${mine.url}`
      status.command = "docserve.openCurrent"
    } else {
      status.text = STATUS_IDLE
      status.tooltip = states.length
        ? `docserve — start server for this workspace (${states.length} running elsewhere)`
        : "docserve — start server for this workspace"
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
  await pickFolder(async (folder) => {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `docserve: starting ${path.basename(folder)}…` },
      () => startServer(folder),
    )
    if (result.ok) {
      openGallery(result.state)
    } else if (result.reason === "enoent") {
      showCliMissing()
    } else {
      void vscode.window.showErrorMessage("docserve: server did not report startup (timeout)")
    }
  })
}

async function open(): Promise<void> {
  const state = await pickRunningServer()
  if (state) openGallery(state)
}

// Status bar main item: open this workspace's gallery, starting it first if needed.
async function openCurrent(): Promise<void> {
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
  if (state) {
    stopServer(state.docsDir)
    void vscode.window.showInformationMessage(`docserve: stopping ${path.basename(state.docsDir)}`)
  }
}

function stopAll(): void {
  stopAllServers()
  void vscode.window.showInformationMessage("docserve: stopping all servers")
}

async function list(): Promise<void> {
  const states = listLiveStates()
  const items: (vscode.QuickPickItem & { run?: () => void })[] = []
  for (const s of states) {
    items.push({
      label: `$(link-external) Open ${serverLabel(s)}`,
      description: s.url,
      run: () => openGallery(s),
    })
  }
  if (states.length > 0) {
    items.push({ kind: vscode.QuickPickItemKind.Separator, label: "stop" })
    for (const s of states) {
      items.push({
        label: `$(stop-circle) Stop ${serverLabel(s)}`,
        run: () => {
          stopServer(s.docsDir)
          void vscode.window.showInformationMessage(`docserve: stopping ${path.basename(s.docsDir)}`)
        },
      })
    }
  }
  items.push({ kind: vscode.QuickPickItemKind.Separator, label: "actions" })
  items.push({ label: "$(play) Start server…", run: () => void start() })
  if (states.length > 0) {
    items.push({ label: "$(circle-slash) Stop all", run: stopAll })
  }
  const picked = await vscode.window.showQuickPick(items, { placeHolder: "docserve servers" })
  picked?.run?.()
}

// "reports (~/repos/research)" — same shape as the desktop tray menu
function serverLabel(state: DocserveState): string {
  return `${path.basename(state.docsDir)} (${tildify(path.dirname(state.docsDir))})`
}

function openGallery(state: DocserveState): void {
  void vscode.env.openExternal(vscode.Uri.parse(state.url))
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

function pickFolder(run: (folder: string) => Promise<void>): Promise<void> {
  return (async () => {
    const folders = vscode.workspace.workspaceFolders
    let folder: string | undefined
    if (!folders || folders.length === 0) {
      const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false })
      folder = picked?.[0]?.fsPath
    } else if (folders.length === 1) {
      folder = folders[0].uri.fsPath
    } else {
      folder = await vscode.window.showQuickPick(folders.map((f) => f.uri.fsPath), { placeHolder: "Which folder?" })
    }
    if (folder) await run(folder)
  })()
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

export function deactivate() { }
