// UpdateListener: watch docsDir recursively for *.html changes and broadcast
// debounced batches over the reload socket.
//
// The gallery list is every *.html except any index.html; files outside that
// set never flip contentSetChanged.
import { existsSync, watch } from "node:fs"
import { basename, resolve } from "node:path"
import { isWithin, listHtmlFiles, normalizedRelative } from "./files.mjs"

const DEBOUNCE_MS = 50 // like livePreview.previewDebounceDelay

export class UpdateListener {
  constructor(options = {}) {
    this.wss = options.wss
    this.docsDir = options.docsDir
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS
    this.knownFiles = new Set()
    this.broadcastQueue = Promise.resolve()
    this.watchers = []

    this.queueBroadcast = debounceBatch((touched) => {
      this.broadcastQueue = this.broadcastQueue
        .then(() => this.broadcastChanges(touched))
        .catch((error) => console.error(error))
    }, this.debounceMs)
  }

  async start() {
    try {
      this.knownFiles = new Set(
        (await listHtmlFiles(this.docsDir)).map((p) => normalizedRelative(this.docsDir, p)),
      )
    } catch {
      this.knownFiles = new Set()
    }

    this.watchers.push(
      watch(this.docsDir, { recursive: true }, (event, filename) => {
        if (!filename?.endsWith(".html")) return
        const full = resolve(this.docsDir, filename)
        if (!isWithin(this.docsDir, full)) return
        this.queueBroadcast(normalizedRelative(this.docsDir, full))
      }).on("error", () => {}),
    )
  }

  async broadcastChanges(touched) {
    let contentSetChanged = false

    for (const rel of touched) {
      if (basename(rel) === "index.html") continue // never a gallery card
      const full = resolve(this.docsDir, rel)
      const exists = existsSync(full)
      const wasKnown = this.knownFiles.has(rel)

      if (exists && !wasKnown) {
        this.knownFiles.add(rel)
        contentSetChanged = true
      } else if (!exists && wasKnown) {
        this.knownFiles.delete(rel)
        contentSetChanged = true
      }
    }

    this.wss.broadcast({ type: "change", pages: touched, contentSetChanged })
  }

  close() {
    this.watchers.forEach((w) => w.close())
  }
}

// Accumulate items during the debounce window and deliver them as one batch.
function debounceBatch(fn, ms) {
  let timer = null
  const pending = new Set()
  return (item) => {
    pending.add(item)
    clearTimeout(timer)
    timer = setTimeout(() => {
      const items = [...pending]
      pending.clear()
      fn(items)
    }, ms)
  }
}
