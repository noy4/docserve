import * as path from "node:path"
import * as vscode from "vscode"
import { listLiveStates, watchStateDirSetting, watchStates } from "./state"

const STATUS_IDLE = "$(play) docserve"

// Main item: open/start this workspace's server.
// Adjacent $(list-unordered) item: the instance list.
export function createStatusBar(): vscode.Disposable {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  status.command = "docserve.open"
  status.tooltip = "docserve — start server for this workspace"
  status.show()

  const listButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99)
  listButton.text = "$(list-unordered)"
  listButton.tooltip = "docserve — running servers"
  listButton.command = "docserve.list"
  listButton.show()

  const refresh = () => {
    const states = listLiveStates()
    const folders = vscode.workspace.workspaceFolders?.map((f) => path.resolve(f.uri.fsPath)) ?? []
    const mine = folders.map((dir) => states.find((s) => s.docsDir === dir)).find(Boolean)
    if (mine) {
      status.text = `$(radio-tower) :${mine.port}`
      status.tooltip = `docserve\nOpen ${mine.url}`
      status.command = "docserve.open"
    } else {
      status.text = STATUS_IDLE
      status.tooltip = "docserve — start server for this workspace"
      status.command = "docserve.open"
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
