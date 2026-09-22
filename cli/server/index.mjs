// docserve server core: HTTP + WebSocket + UpdateListener.
//
// ┌────────────────────────────────────────────────────────┐
// │ runServer()                                            │
// │ ├─ createServer ──▶ handler()                          │ # HTTP
// │ │   ├─ /api/files ──▶ apiFiles()                       │
// │ │   ├─ /, /index.html ──▶ gallery template             │
// │ │   └─ other paths ──▶ raw files ──▶ injectIntoHtml()   │
// │ ├─ WebSocketServer("/__reload") ◀─ listener broadcast   │
// │ └─ listen ──▶ UpdateListener.start() + writeState()    │
// └────────────────────────────────────────────────────────┘
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { existsSync, watch } from "node:fs"
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path"
import { exec } from "node:child_process"
import { createHash } from "node:crypto"
import { clearState, writeState } from "./state.mjs"
import { apiFiles, listHtmlFiles } from "./files.mjs"
import { injectIntoHtml, WS_PATH } from "./inject.mjs"

const DEBOUNCE_MS = 50 // like livePreview.previewDebounceDelay
const MAX_PORT_TRIES = 20 // on conflict, try the next port up to 20 times
const INDEX_TEMPLATE = resolve(import.meta.dirname, "..", "index.html")

const MIME = {
  ".html": "text/html",
  ".htm": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".xml": "application/xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
}

export async function runServer({ docsDir, port: initialPort, open = false }) {
  const wss = new WebSocketServer({ path: WS_PATH })
  const updateListener = new UpdateListener({ wss, docsDir })
  let port = initialPort // actually bound port (may fall back +1 on conflict)

  const cleanup = () => {
    updateListener.close()
    clearState()
  }
  process.on("SIGINT", () => {
    cleanup()
    process.exit(0)
  })
  process.on("SIGTERM", () => {
    cleanup()
    process.exit(0)
  })

  const server = createServer(createNodeServerAdapter(createHandler({ docsDir })))
  wss.attach(server)
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && port < initialPort + MAX_PORT_TRIES) {
      port += 1
      server.listen(port, "127.0.0.1")
    } else {
      console.error(err)
      process.exit(1)
    }
  })
  server.listen(port, "127.0.0.1", async () => {
    await updateListener.start()
    const state = { pid: process.pid, port, url: `http://localhost:${port}/`, docsDir }
    writeState(state)
    console.log(state.url)
    if (open && process.platform === "darwin") exec(`open ${state.url}`)
  })
  return { server, wss, updateListener }
}

// --- Node server adapter ---

function createNodeServerAdapter(handler) {
  return async (req, res) => {
    try {
      const response = await handler(toWebRequest(req))
      res.writeHead(response.status, Object.fromEntries(response.headers))
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (err) {
      console.error(err)
      res.writeHead(500, { "content-type": "text/plain" })
      res.end("Internal Server Error")
    }
  }
}

function toWebRequest(req) {
  const host = req.headers.host || "localhost"
  return new Request(`http://${host}${req.url}`, { method: req.method, headers: req.headers })
}

// --- HTTP handler ---

function createHandler({ docsDir }) {
  return async function handler(request) {
    const url = new URL(request.url)

    if (url.pathname === "/api/files") {
      try {
        return Response.json(await apiFiles(docsDir))
      } catch (err) {
        console.error(err)
        return Response.json([])
      }
    }

    let pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response("Bad Request", { status: 400 })
    }

    if (pathname === "/" || pathname === "/index.html") {
      return galleryResponse(docsDir)
    }

    if (pathname.includes("\0")) {
      return new Response("Bad Request", { status: 400 })
    }

    const path = resolve(docsDir, pathname.slice(1))
    if (!isWithin(docsDir, path)) {
      return new Response("Forbidden", { status: 403 })
    }

    try {
      const body = await readFile(path)
      const type = MIME[extname(path).toLowerCase()] || "application/octet-stream"
      // Inject the reload client + copy path button into docsDir pages only;
      // the gallery template ships its own client.
      if (type === "text/html") {
        const html = injectIntoHtml(body.toString(), normalizedRelative(docsDir, path), path)
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
      }
      return new Response(body, { headers: { "content-type": type } })
    } catch {
      return new Response("Not Found", { status: 404 })
    }
  }
}

// The gallery is an embedded template served at / and /index.html; docsDir's own
// index.html is shadowed by it. __DOCSERVE_DIR__ is substituted for display.
async function galleryResponse(docsDir) {
  try {
    let html = await readFile(INDEX_TEMPLATE, "utf8")
    html = html.replaceAll("__DOCSERVE_DIR__", escapeHtml(docsDir))
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
  } catch {
    return new Response("Gallery template missing", { status: 500 })
  }
}

// --- Watching ---

class UpdateListener {
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
      }).on("error", () => { }),
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

// --- Path utilities ---

function isWithin(base, path) {
  const rel = relative(base, path)
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

function normalizedRelative(base, path) {
  return relative(base, path).split(sep).join("/")
}

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

// --- WebSocketServer (RFC 6455 ws-compatible subset) ---

class WebSocketServer {
  constructor(options = {}) {
    this.path = options.path
    this.clients = new Set()
    if (options.server) {
      this.attach(options.server)
    }
  }

  attach(server) {
    server.on("upgrade", (req, socket) => this.handleUpgrade(req, socket))
  }

  handleUpgrade(req, socket) {
    const url = new URL(req.url, "http://localhost")
    if (this.path && url.pathname !== this.path) {
      socket.destroy()
      return
    }
    const key = req.headers["sec-websocket-key"]
    if (!key) {
      socket.destroy()
      return
    }
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`,
    )
    socket.setNoDelay(true)
    this.clients.add(socket)
    socket.on("close", () => this.clients.delete(socket))
    socket.on("error", () => this.clients.delete(socket))
    // Answer pings to keep the connection alive
    socket.on("data", (buf) => {
      if (buf.length > 0 && (buf[0] & 0x0f) === 0x9) {
        socket.write(Buffer.from([0x8a, 0x00])) // pong
      }
    })
  }

  broadcast(payload) {
    const frame = encodeFrame(typeof payload === "string" ? payload : JSON.stringify(payload))
    for (const socket of this.clients) {
      try {
        socket.write(frame)
      } catch {
        this.clients.delete(socket)
      }
    }
  }
}

function acceptKey(key) {
  return createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64")
}

function encodeFrame(text) {
  const payload = Buffer.from(text)
  const len = payload.length
  let header
  if (len < 126) {
    header = Buffer.from([0x81, len])
  } else if (len < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 127
    header.writeBigUInt64BE(BigInt(len), 2)
  }
  return Buffer.concat([header, payload])
}
