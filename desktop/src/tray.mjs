// The menu bar tray: status, instance rows (Open / Stop), Open Folder…, Quit.
import os from "node:os"
import path from "node:path"
import { Tray, Menu, nativeImage, dialog, shell, app } from "electron"
import { dev } from "./dev.mjs"
import { latestRelease, isNewer } from "./update.mjs"

export class TrayController {
  constructor(server) {
    this.server = server
    this.tray = null
    this.icons = null
    this.lastStatus = null
    this.updateAvailable = null
  }

  boot() {
    this.icons = {
      running: loadIcon("tray-running", { dev }),
      stopped: loadIcon("tray-stopped", { dev }),
      menuRunning: loadIcon("menu-running", { template: false }),
      menuStopped: loadIcon("menu-stopped", { template: false }),
    }
    this.tray = new Tray(this.icons.stopped)
    this.update()
    this.#checkForUpdate()
  }

  #checkForUpdate() {
    const check = async () => {
      const rel = await latestRelease()
      if (rel && isNewer(rel.version, app.getVersion()) && this.tray) {
        this.updateAvailable = rel
        this.update()
      }
    }
    check()
    setInterval(check, 12 * 60 * 60 * 1000).unref()
  }

  update() {
    if (!this.tray) return
    const states = this.server.getStates()
    const status = states.length ? "running" : this.server.isStarting() ? "starting" : "stopped"
    this.tray.setImage(status === "running" ? this.icons.running : this.icons.stopped)
    this.tray.setToolTip('docserve')
    this.tray.setContextMenu(this.#buildMenu(states, status))
    if (status !== this.lastStatus) {
      this.lastStatus = status
      console.log(`[docserve-desktop] tray: ${status}`)
    }
  }

  #buildMenu(states, status) {
    const ___ = { type: "separator" }

    const updateItems = []
    if (this.updateAvailable) {
      updateItems.push({
        label: `New version available — v${this.updateAvailable.version}`,
        click: () => shell.openExternal(this.updateAvailable.url),
      })
      updateItems.push(___)
    }

    const recentDirs = this.server.readRecentDirs()
    const recentItem = recentDirs.length && {
      label: "Open Recent",
      submenu: recentDirs.map((dir) => ({
        label: `${path.basename(dir) || dir} (${tildePath(path.dirname(dir))})`,
        click: () => {
          const running = states.find((state) => state.docsDir === dir)
          if (running) shell.openExternal(running.url)
          else this.server.start(dir, { open: true })
        },
      })),
    }

    return Menu.buildFromTemplate([
      // status
      {
        label: status === "running" ? `Running (${states.length})` : "Stopped",
        icon: status === "running" ? this.icons.menuRunning : this.icons.menuStopped,
        enabled: false,
      },
      // running servers
      states.map((state) => ({
        label: `${path.basename(state.docsDir) || state.docsDir} (${tildePath(path.dirname(state.docsDir))})`,
        submenu: [
          {
            label: `Open (localhost:${safePort(state.url)})`,
            click: () => shell.openExternal(state.url),
          },
          { label: "Stop", click: () => this.server.stopDir(state.docsDir) },
        ],
      })),
      ___,

      // actions
      { label: "Open Folder...", click: () => this.openFolder(true) },
      recentItem,
      { label: "Stop All", enabled: states.length > 0, click: () => this.server.stop() },
      ___,

      updateItems,
      { label: "Quit docserve", click: () => this.#quit() },
    ].flat().filter(Boolean))
  }

  async openFolder(open = false) {
    // LSUIElement app: without stealing focus the dialog opens behind Finder.
    if (process.platform === "darwin") {
      app.focus({ steal: true })
      await sleep(100)
    }
    const result = await dialog.showOpenDialog({
      title: "docserve — Choose a folder to serve",
      defaultPath: this.server.readRecentDirs()[0] || os.homedir(),
      properties: ["openDirectory"],
    })
    const dir = result.filePaths[0]
    if (result.canceled || !dir) return
    const existing = this.server.getStates().find((state) => state.docsDir === dir)
    if (existing) {
      if (open) shell.openExternal(existing.url)
      return
    }
    this.server.start(dir, { open })
  }

  #quit() { app.quit() }
}

function loadIcon(name, { template = true, dev = false } = {}) {
  const image = nativeImage.createFromPath(
    path.join(import.meta.dirname, "assets", `${name}${dev ? "-dev" : ""}@2x.png`),
  )
  image.setTemplateImage(template)
  return image
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function safePort(url) {
  try {
    return new URL(url).port || "80"
  } catch {
    return "?"
  }
}

// Collapse the home directory prefix to ~ for display.
function tildePath(p) {
  const home = os.homedir()
  return p.startsWith(`${home}/`) ? `~${p.slice(home.length)}` : p
}
