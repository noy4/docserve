// Watches docsDir for *.html / *.css and the gallery template, broadcasting
// debounced reload batches. The gallery set is every *.html except index.html;
// only additions/removals flip contentSetChanged.
import { existsSync, watch } from "node:fs"
import { basename, dirname, resolve } from "node:path"
import { isWithin, listHtmlFiles, normalizedRelative, shouldIgnore } from "./files.mjs"

const DEBOUNCE_MS = 50

export class FileWatcher {
  constructor(options = {}) {
    this.wss = options.wss
    this.docsDir = options.docsDir
    this.templatePath = options.templatePath
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS
    this.knownFiles = new Set()
    this.queue = Promise.resolve()
    this.watchers = []
    this.pending = { pages: new Set(), css: new Set(), template: false }

    // html/css/template edits in one burst flush together
    this.queueFlush = debounce(() => {
      const { pages, css, template } = this.pending
      this.pending = { pages: new Set(), css: new Set(), template: false }
      if (pages.size || template) {
        this.enqueue(() => this.broadcastChanges({ pages: [...pages], template }))
      }
      if (css.size)
        this.enqueue(() => this.broadcastCss([...css]))
    }, this.debounceMs)
  }

  enqueue(task) {
    this.queue = this.queue.then(task)
      .catch((error) => console.error(error))
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
        if (!filename || shouldIgnore(filename)) return
        const full = resolve(this.docsDir, filename)
        if (!isWithin(this.docsDir, full)) return
        const rel = normalizedRelative(this.docsDir, full)

        if (filename.endsWith(".html")) {
          this.pending.pages.add(rel)
          this.queueFlush()
        } else if (filename.endsWith(".css")) {
          this.pending.css.add(rel)
          this.queueFlush()
        }
      }).on("error", () => { }),
    )

    if (this.templatePath) {
      // Watch the directory
      const templateName = basename(this.templatePath)
      this.watchers.push(
        watch(dirname(this.templatePath), (event, filename) => {
          if (filename === templateName) {
            this.pending.template = true
            this.queueFlush()
          }
        }).on("error", () => { }),
      )
    }
  }

  async broadcastChanges({ pages, template }) {
    this.wss.broadcast({
      type: "change",
      pages,
      contentSetChanged: syncKnownFiles(this.knownFiles, this.docsDir, pages),
      templateChanged: template,
    })
  }

  // Refresh linked stylesheets in place.
  broadcastCss(files) {
    this.wss.broadcast({ type: "css", files })
  }

  close() {
    this.watchers.forEach((w) => w.close())
  }
}

// True when pages were added to or removed from the gallery.
function syncKnownFiles(knownFiles, docsDir, pages) {
  let changed = false
  for (const rel of pages) {
    if (basename(rel) === "index.html") continue // not a gallery card
    const exists = existsSync(resolve(docsDir, rel))
    const wasKnown = knownFiles.has(rel)
    if (exists === wasKnown) continue
    if (exists) knownFiles.add(rel)
    else knownFiles.delete(rel)
    changed = true
  }
  return changed
}

// Trailing-edge debounce.
function debounce(fn, ms) {
  let timer = null
  return () => {
    clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
}
