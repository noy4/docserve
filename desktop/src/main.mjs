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
import { ServerManager } from "./server.mjs"
import { TrayController } from "./tray.mjs"
import { StateWatcher } from "./state.mjs"

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
    this.server.onStartError = (message) => dialog.showErrorBox("Docserve", message)
  }

  start() {
    app.on("second-instance", () => this.tray.update())
    // Snapshot the running set before stopping, so the next launch resumes
    // exactly the folders that were serving at quit.
    app.on("before-quit", () => {
      this.server.snapshotRunningDirs()
      this.server.stopSync()
    })
    app.on("window-all-closed", () => {})
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

  // Auto-resume: bring back the folders that were serving at quit; without a
  // snapshot (first run / crash), fall back to the most recent folder, or ask.
  // Running servers are never disturbed.
  #resume() {
    if (this.server.getStates().length) return
    const resumeDirs = this.server.readResumeDirs()
    if (resumeDirs) {
      for (const dir of resumeDirs) this.server.start(dir, { silent: true })
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
