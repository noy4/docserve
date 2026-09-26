// FileWatcher: watch docsDir recursively for *.html changes and broadcast
// debounced batches over the reload socket. The gallery template is watched
// too; its edits set templateChanged so gallery tabs pick them up even though
// nothing in docsDir changed.
//
// The gallery list is every *.html except any index.html; files outside that
// set never flip contentSetChanged.
import { existsSync, watch } from "node:fs"
import { basename, dirname, resolve } from "node:path"
import { isWithin, listHtmlFiles, normalizedRelative, shouldIgnore } from "./files.mjs"

const DEBOUNCE_MS = 50 // like livePreview.previewDebounceDelay
const TEMPLATE_TOUCH = "\u0000template" // sentinel: never a real docsDir-relative path

export class FileWatcher {
  constructor(options = {}) {
    this.wss = options.wss
    this.docsDir = options.docsDir
    this.templatePath = options.templatePath
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
        if (shouldIgnore(filename)) return
        const full = resolve(this.docsDir, filename)
        if (!isWithin(this.docsDir, full)) return
        this.queueBroadcast(normalizedRelative(this.docsDir, full))
      }).on("error", () => {}),
    )

    if (this.templatePath) {
      // Watch the template's directory: atomic saves replace the file, so the
      // file itself would miss events.
      const templateName = basename(this.templatePath)
      this.watchers.push(
        watch(dirname(this.templatePath), (event, filename) => {
          if (filename === templateName) this.queueBroadcast(TEMPLATE_TOUCH)
        }).on("error", () => {}),
      )
    }
  }

  async broadcastChanges(touched) {
    let contentSetChanged = false
    const templateChanged = touched.includes(TEMPLATE_TOUCH)
    const pages = touched.filter((rel) => rel !== TEMPLATE_TOUCH)

    for (const rel of pages) {
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

    this.wss.broadcast({ type: "change", pages, contentSetChanged, templateChanged })
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
