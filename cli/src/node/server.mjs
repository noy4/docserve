// Server lifecycle: bind with port fallback, wire the watcher and socket, and
// write the state file the CLI and desktop app read.
//
// ┌──────────────────────────────────────────────────────────┐
// │ runServer()                                              │
// │ ├─ createServer ──▶ routes.createHandler()               │
// │ ├─ WebSocketServer("/__reload") ◀─ FileWatcher           │
// │ └─ listen ──▶ watcher.start() + writeState()             │
// └──────────────────────────────────────────────────────────┘
import { exec } from "node:child_process"
import { createServer } from "node:http"
import { INDEX_TEMPLATE } from "./gallery.mjs"
import { createHandler } from "./routes.mjs"
import { clearState, writeState } from "./state.mjs"
import { FileWatcher } from "./watch.mjs"
import { WebSocketServer } from "./websocket.mjs"
import { WS_PATH } from "./inject.mjs"

const MAX_PORT_TRIES = 20 // on conflict, try the next port up to 20 times

/**
 * @param {{ docsDir: string, port: number, open?: boolean }} options
 */
export async function runServer({ docsDir, port: initialPort, open = false }) {
  const wss = new WebSocketServer({ path: WS_PATH })
  const fileWatcher = new FileWatcher({ wss, docsDir, templatePath: INDEX_TEMPLATE })
  let port = initialPort

  const server = createServer(createNodeServerAdapter(createHandler({ docsDir })))
  wss.attach(server)

  const cleanup = () => {
    fileWatcher.close()
    wss.close()
    clearState()
    server.closeAllConnections()
    if (server.listening) server.close()
  }
  process.on("SIGINT", () => { cleanup(); process.exit(0) })
  process.on("SIGTERM", () => { cleanup(); process.exit(0) })

  server.on("error", (/** @type {NodeJS.ErrnoException} */ err) => {
    if (err.code === "EADDRINUSE" && port < initialPort + MAX_PORT_TRIES) {
      port += 1
      server.listen(port, "127.0.0.1")
    } else {
      console.error(err)
      process.exit(1)
    }
  })
  server.listen(port, "127.0.0.1", async () => {
    await fileWatcher.start()
    const state = { pid: process.pid, port, url: `http://localhost:${port}/`, docsDir }
    writeState(state)
    console.log(state.url)
    if (open && process.platform === "darwin") exec(`open ${state.url}`)
  })
  return { server, wss, fileWatcher, close: cleanup }
}

// --- Node server adapter ---

function createNodeServerAdapter(handler) {
  return async (/** @type {import("node:http").IncomingMessage} */ req, /** @type {import("node:http").ServerResponse} */ res) => {
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