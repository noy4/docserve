// Rebuilds the menu on state changes: fs.watch + 2 s polling + pid liveness.
import fs from "node:fs"

const POLL_INTERVAL_MS = 2000
const DEBOUNCE_MS = 150

export class StateWatcher {
  constructor(server, onChange) {
    this.server = server
    this.onChange = onChange
    this.watchers = []
    this.timer = null
    this.poll = null
  }

  start() {
    this.#arm()
    this.poll = setInterval(this.onChange, POLL_INTERVAL_MS)
  }

  #arm() {
    for (const watcher of this.watchers) {
      try {
        watcher.close()
      } catch {}
    }
    this.watchers = []
    for (const dir of this.server.watchPaths()) {
      this.#watch(dir)
    }
  }

  #watch(dir) {
    try {
      const watcher = fs.watch(dir, () => this.#schedule())
      watcher.on("error", () => {})
      this.watchers.push(watcher)
    } catch {}
  }

  #schedule() {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.#arm()
      this.onChange()
    }, DEBOUNCE_MS)
  }
}
