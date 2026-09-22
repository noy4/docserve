// docserve desktop — a macOS menu bar client with zero windows.
//
// The Electron main process only spawns the CLI and watches state.json; all
// serving stays in the CLI process.
//
// ┌────────────────────────────────────────────────────────┐
// │ App                                                    │
// │ ├─ ServerManager  spawn/stop CLI · state.json          │
// │ ├─ StateWatcher   fs.watch + 2 s polling → update()    │
// │ └─ TrayController menu · icons · Change Folder…        │
// └────────────────────────────────────────────────────────┘
import { app, dialog } from "electron"
import { ServerManager } from "./server-manager.mjs"
import { TrayController } from "./tray-controller.mjs"
import { StateWatcher } from "./state-watcher.mjs"

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.whenReady().then(() => new App().start())
}

class App {
  constructor() {
    this.server = new ServerManager()
    this.tray = new TrayController(this.server)
    this.watcher = new StateWatcher(this.server, () => this.tray.update())

    this.server.onChange = () => this.tray.update()
    this.server.onStartError = (message) => dialog.showErrorBox("docserve", message)
  }

  start() {
    app.on("second-instance", () => this.tray.update())
    app.on("before-quit", () => this.server.stopSync())
    app.on("window-all-closed", () => {})
    this.#boot()
  }

  #boot() {
    if (process.platform === "darwin" && app.dock)
      app.dock.hide()
    this.server.ensureCliSymlink()
    this.tray.boot()
    this.watcher.start()
    console.log("[docserve-desktop] tray ready")
  }
}
