import * as path from "node:path"
import * as vscode from "vscode"
import { listLiveStates, watchStateDirSetting, watchStates } from "./state"

// status: open/start this workspace. listButton: list all servers.
// Same priority so the pair stays adjacent: ties sort by hash(id), and anything
// landing between the two ids' hashes is practically impossible.
export function createStatusBar(): vscode.Disposable {
  const status = vscode.window.createStatusBarItem("main", vscode.StatusBarAlignment.Right, 100)
  status.name = "docserve gallery"
  status.command = "docserve.open"
  status.show()

  const listButton = vscode.window.createStatusBarItem("list", vscode.StatusBarAlignment.Right, 100)
  listButton.name = "docserve servers"
  listButton.text = "$(list-unordered)"
  listButton.tooltip = "docserve — running servers"
  listButton.command = "docserve.list"
  listButton.show()

  const refresh = () => {
    const states = listLiveStates()
    const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
    const mine = folders.map((dir) => states.find((s) => s.docsDir === dir)).find(Boolean)
    if (mine) {
      status.text = `$(multiple-windows) :${mine.port}`
      status.tooltip = `docserve — Open ${mine.url}`
    } else {
      status.text = "$(multiple-windows) Open Gallery"
      status.tooltip = "docserve — open gallery"
    }
  }
  refresh()

  return vscode.Disposable.from(
    status,
    listButton,
    watchStates(refresh),
    watchStateDirSetting(refresh),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
  )
}
