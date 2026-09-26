import * as vscode from "vscode"

const STATUS_IDLE = "$(radio-tower) docserve"

export function activate(context: vscode.ExtensionContext) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  status.text = STATUS_IDLE
  status.tooltip = "docserve — no servers running"
  status.command = "docserve.list"
  status.show()
  context.subscriptions.push(status)

  context.subscriptions.push(
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
      void vscode.window.showInformationMessage("docserve: no servers running (not implemented yet)")
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
