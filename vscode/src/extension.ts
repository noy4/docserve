import * as path from "node:path"
import * as vscode from "vscode"
import { DocserveState, findByDir, listLiveStates, watchStateDirSetting, watchStates } from "./state"

const STATUS_IDLE = "$(radio-tower) docserve"

export function activate(context: vscode.ExtensionContext) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  status.command = "docserve.list"
  status.show()

  const refresh = () => {
    const states = listLiveStates()
    const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
    const mine = folders.map((dir) => findByDir(states, dir)).find(Boolean) as DocserveState | undefined
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

  context.subscriptions.push(
    status,
    watchStates(refresh),
    watchStateDirSetting(refresh),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
    vscode.commands.registerCommand("docserve.start", async () => {
      const folder = await pickFolder()
      if (!folder) return
      void vscode.window.showInformationMessage(`docserve: serving ${folder} (not implemented yet)`)
    }),
    vscode.commands.registerCommand("docserve.open", () => {
      void vscode.window.showInformationMessage("docserve: open gallery (not implemented yet)")
    }),
    vscode.commands.registerCommand("docserve.stop", () => {
      void vscode.window.showInformationMessage("docserve: stop server (not implemented yet)")
    }),
    vscode.commands.registerCommand("docserve.stopAll", () => {
      void vscode.window.showInformationMessage("docserve: stop all servers (not implemented yet)")
    }),
    vscode.commands.registerCommand("docserve.list", () => {
      const states = listLiveStates()
      if (states.length === 0) {
        void vscode.window.showInformationMessage("docserve: no servers running")
        return
      }
      void vscode.window.showQuickPick(
        states.map((s) => ({ label: `$(radio-tower) :${s.port}`, description: s.docsDir, detail: s.url, state: s })),
        { placeHolder: "docserve servers" },
      )
    }),
  )
}

async function pickFolder(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) {
    const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false })
    return picked?.[0]?.fsPath
  }
  if (folders.length === 1)
    return folders[0].uri.fsPath

  return vscode.window.showQuickPick(folders.map((f) => f.uri.fsPath), { placeHolder: "Which folder?" })
}

export function deactivate() { }
