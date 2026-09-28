import * as path from "node:path"
import * as vscode from "vscode"
import { listLiveStates, watchStateDirSetting, watchStates } from "./state"

// Shows the port while serving this workspace; click opens the servers menu.
export function createStatusBar(): vscode.Disposable {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  status.command = "docserve.list"
  status.tooltip = "docserve - open servers menu"
  status.show()

  const refresh = () => {
    const states = listLiveStates()
    const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
    const mine = folders.map((dir) => states.find((s) => s.docsDir === dir)).find(Boolean)
    status.text = mine ? `$(multiple-windows) :${mine.port}` : "$(multiple-windows) docserve"
  }
  refresh()

  return vscode.Disposable.from(
    status,
    watchStates(refresh),
    watchStateDirSetting(refresh),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
  )
}
