import * as vscode from "vscode"
import { list, open, stop, stopAll } from "./commands"
import { disposeLog } from "./server"
import { createStatusBar } from "./status-bar"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    createStatusBar(),
    vscode.commands.registerCommand("docserve.open", open),
    vscode.commands.registerCommand("docserve.stop", stop),
    vscode.commands.registerCommand("docserve.stopAll", stopAll),
    vscode.commands.registerCommand("docserve.list", list),
    { dispose: disposeLog },
  )
}

export function deactivate() { }
