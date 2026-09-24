// docserve desktop — a macOS menu bar client with zero windows.
//
// The Electron main process only spawns the CLI and watches the CLI's state
// files; all serving stays in the CLI process.
//
// ┌────────────────────────────────────────────────────────┐
// │ App                                                    │
// │ ├─ ServerManager  spawn/stop CLI · state files         │
// │ ├─ StateWatcher   fs.watch + 2 s polling → update()    │
// │ └─ TrayController menu · icons · Add Folder…           │
// └────────────────────────────────────────────────────────┘
import { app, dialog } from "electron"
import { sandboxDev } from "./dev.mjs"
import { ServerManager } from "./server.mjs"
import { TrayController } from "./tray.mjs"
import { StateWatcher } from "./state.mjs"

sandboxDev()

// Single-instance lock: without it a second launch would add a second tray icon and manage the CLI twice.
const gotLock = app.requestSingleInstanceLock()
if (gotLock) {
  app.whenReady().then(() => new App().start())
} else {
  app.quit()
}

class App {
  constructor() {
    this.server = new ServerManager()
    this.tray = new TrayController(this.server)
    this.watcher = new StateWatcher(this.server, () => this.tray.update())

    this.server.onChange = () => this.tray.update()
    this.server.onStartError = (message) => dialog.showErrorBox("Docserve", message)
  }

  start() {
    app.on("second-instance", () => this.tray.update())
    app.on("before-quit", () => {
      this.server.snapshotRunningDirs()
      this.server.stopSync()
    })
    app.on("window-all-closed", () => { })
    this.#boot()
  }

  #boot() {
    if (process.platform === "darwin" && app.dock)
      app.dock.hide()
    this.server.ensureCliSymlink()
    this.tray.boot()
    this.watcher.start()
    this.#resume()
  }

  // Resume the quit-time set; without a snapshot, the most recent folder, or ask.
  #resume() {
    if (this.server.getStates().length) return
    const resumeDirs = this.server.readResumeDirs()
    if (resumeDirs) {
      for (const dir of resumeDirs)
        this.server.start(dir, { silent: true })
      return
    }
    const dir = this.server.readRecentDirs()[0]
    if (dir) {
      this.server.start(dir, { silent: true })
    } else {
      this.tray.addFolder(true)
    }
  }
}
