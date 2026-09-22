// The menu bar tray: status item, Open, Stop Server, Change Folder…, Quit.
import os from "node:os"
import path from "node:path"
import { Tray, Menu, nativeImage, dialog, shell, app } from "electron"

export class TrayController {
  constructor(server) {
    this.server = server
    this.tray = null
    this.icons = null
    this.lastStatus = null
  }

  boot() {
    this.icons = {
      running: loadIcon("tray-running"),
      stopped: loadIcon("tray-stopped"),
      menuRunning: loadIcon("menu-running", false),
      menuStopped: loadIcon("menu-stopped", false),
    }
    this.tray = new Tray(this.icons.stopped)
    this.update()
  }

  update() {
    if (!this.tray) return
    const state = this.server.getState()
    this.tray.setImage(state.status === "running" ? this.icons.running : this.icons.stopped)
    this.tray.setToolTip(`docserve — ${state.running ? state.url : "stopped"}`)
    this.tray.setContextMenu(this.#buildMenu(state))
    if (state.status !== this.lastStatus) {
      this.lastStatus = state.status
      console.log(`[docserve-desktop] tray: ${state.status}`)
    }
  }

  #buildMenu(state) {
    const port = state.running ? safePort(state.url) : null
    return Menu.buildFromTemplate([
      {
        label:
          state.status === "running"
            ? "Running"
            : state.status === "starting"
              ? "Starting…"
              : "Stopped",
        icon: state.status === "running" ? this.icons.menuRunning : this.icons.menuStopped,
        enabled: false,
      },
      {
        label: state.running ? `Open (localhost:${port})` : "Open (Start Server)",
        click: () => state.running
          ? shell.openExternal(state.url)
          : this.#start(),
      },
      {
        label: "Stop Server",
        enabled: state.running,
        click: () => this.server.stop(),
      },
      { type: "separator" },
      {
        label: `Serving: ${state.docsDir ?? this.server.readLastDir() ?? "—"}`,
        enabled: false,
      },
      { label: "Change Folder...", click: () => this.#changeFolder(true) },
      { type: "separator" },
      { label: "Quit docserve", click: () => this.#quit() },
    ])
  }

  #start() {
    const dir = this.server.readLastDir()
    if (dir) {
      this.server.start(dir, { open: true })
    } else {
      this.#changeFolder(true)
    }
  }

  async #changeFolder(open = false) {
    const result = await dialog.showOpenDialog({
      title: "docserve — Choose a folder to serve",
      defaultPath: this.server.readLastDir() || os.homedir(),
      properties: ["openDirectory"],
    })
    const dir = result.filePaths[0]
    if (result.canceled || !dir) return
    if (this.server.isRunning()) await this.server.stop()
    this.server.start(dir, { open })
  }

  async #quit() {
    if (this.server.isRunning()) await this.server.stop()
    app.quit()
  }
}

function loadIcon(name, template = true) {
  const image = nativeImage.createFromPath(path.join(import.meta.dirname, "assets", `${name}@2x.png`))
  image.setTemplateImage(template)
  return image
}

function safePort(url) {
  try {
    return new URL(url).port || "80"
  } catch {
    return "?"
  }
}
