// docserve server core: HTTP layer + server lifecycle.
//
// ┌────────────────────────────────────────────────────────┐
// │ runServer()                                            │
// │ ├─ createServer ──▶ handler()                          │ # HTTP
// │ │   ├─ /api/files ──▶ apiFiles()                       │
// │ │   ├─ /, /index.html ──▶ gallery template             │
// │ │   └─ other paths ──▶ raw files ──▶ injectIntoHtml()  │
// │ ├─ WebSocketServer("/__reload") ◀─ UpdateListener      │
// │ └─ listen ──▶ listener.start() + writeState()          │
// └────────────────────────────────────────────────────────┘
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { basename, extname, resolve } from "node:path"
import { exec } from "node:child_process"
import { clearState, writeState } from "./state.mjs"
import { apiFiles, isWithin, normalizedRelative } from "./files.mjs"
import { injectIntoHtml, WS_PATH } from "./inject.mjs"
import { WebSocketServer } from "./websocket.mjs"
import { UpdateListener } from "./watch.mjs"

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
  const updateListener = new UpdateListener({ wss, docsDir, templatePath: INDEX_TEMPLATE })
  let port = initialPort

  const server = createServer(createNodeServerAdapter(createHandler({ docsDir })))
  wss.attach(server)

  const cleanup = () => {
    updateListener.close()
    wss.close()
    clearState()
    server.closeAllConnections()
    if (server.listening) server.close()
  }
  process.on("SIGINT", () => { cleanup(); process.exit(0) })
  process.on("SIGTERM", () => { cleanup(); process.exit(0) })

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
  return { server, wss, updateListener, close: cleanup }
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
// index.html is shadowed by it. Directory markers are substituted for display.
async function galleryResponse(docsDir) {
  try {
    let html = await readFile(INDEX_TEMPLATE, "utf8")
    html = html
      .replaceAll("__DOCSERVE_NAME__", escapeHtml(basename(docsDir) || docsDir))
      .replaceAll("__DOCSERVE_DIR__", escapeHtml(docsDir))
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
  } catch {
    return new Response("Gallery template missing", { status: 500 })
  }
}

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}
