import * as path from "node:path"
import * as vscode from "vscode"
import { disposeLog, startServer, stopAllServers, stopServer } from "./server"
import { DocserveState, listLiveStates } from "./state"

const STATUS_IDLE = "$(radio-tower) docserve"

export function activate(context: vscode.ExtensionContext) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  status.command = "docserve.list"
  status.show()

  const refresh = () => {
    const states = listLiveStates()
    const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
    const mine = folders.map((dir) => states.find((s) => s.docsDir === dir)).find(Boolean)
    if (mine) {
      status.text = `$(radio-tower) :${mine.port}`
      status.tooltip = `docserve — serving ${mine.docsDir}\n${mine.url}`
      status.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
    } else {
      status.text = STATUS_IDLE
      status.tooltip = states.length
        ? `docserve — ${states.length} server(s) running elsewhere`
        : "docserve — no servers running"
      status.backgroundColor = undefined
    }
  }
  refresh()

  const start = () =>
    pickFolder(async (folder) => {
      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `docserve: starting ${path.basename(folder)}…` },
        () => startServer(folder),
      )
      if (result.ok) {
        const pick = await vscode.window.showInformationMessage(
          `docserve: serving at ${result.state.url}`,
          "Open Gallery",
        )
        if (pick) openGallery(result.state)
      } else if (result.reason === "enoent") {
        showCliMissing()
      } else {
        void vscode.window.showErrorMessage("docserve: server did not report startup (timeout)")
      }
    })

  const open = async () => {
    const state = await pickRunningServer()
    if (state) openGallery(state)
  }

  const stop = async () => {
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

  context.subscriptions.push(
    status,
    vscode.commands.registerCommand("docserve.start", start),
    vscode.commands.registerCommand("docserve.open", open),
    vscode.commands.registerCommand("docserve.stop", stop),
    vscode.commands.registerCommand("docserve.stopAll", () => {
      stopAllServers()
      void vscode.window.showInformationMessage("docserve: stopping all servers")
    }),
    vscode.commands.registerCommand("docserve.list", async () => {
      const states = listLiveStates()
      const items: (vscode.QuickPickItem & { run?: () => void })[] = []
      for (const s of states) {
        const name = path.basename(s.docsDir)
        items.push({
          label: `$(link-external) Open :${s.port}`,
          description: name,
          detail: s.url,
          run: () => openGallery(s),
        })
        items.push({
          label: `$(stop-circle) Stop :${s.port}`,
          description: name,
          run: () => {
            stopServer(s.docsDir)
            void vscode.window.showInformationMessage(`docserve: stopping ${name}`)
          },
        })
      }
      items.push({ kind: vscode.QuickPickItemKind.Separator, label: "actions" })
      items.push({ label: "$(play) Start server…", run: start })
      if (states.length > 0) {
        items.push({
          label: "$(circle-slash) Stop all",
          run: () => {
            stopAllServers()
            void vscode.window.showInformationMessage("docserve: stopping all servers")
          },
        })
      }
      const picked = await vscode.window.showQuickPick(items, { placeHolder: "docserve servers" })
      picked?.run?.()
    }),
    { dispose: disposeLog },
  )
}

function openGallery(state: DocserveState): void {
  void vscode.env.openExternal(vscode.Uri.parse(state.url))
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

function pickFolder(run: (folder: string) => Promise<void>): void {
  void (async () => {
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
  return vscode.window.showQuickPick(
    states.map((s) => ({ label: `$(radio-tower) :${s.port}`, description: path.basename(s.docsDir), detail: s.url, state: s })),
    { placeHolder: "Which server?" },
  ).then((picked) => picked?.state)
}

export function deactivate() { }
