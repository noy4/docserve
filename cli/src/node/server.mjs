// Server lifecycle: bind with port fallback, wire the watcher and socket, and
// write the state file the CLI and desktop app read.
//
// ┌──────────────────────────────────────────────────────────┐
// │ runServer()                                              │
// │ ├─ createServer ──▶ adapter(createHandler())             │
// │ ├─ WebSocketServer("/__reload") ◀─ FileWatcher           │
// │ └─ listen ──▶ watcher.start() + writeState()             │
// └──────────────────────────────────────────────────────────┘
import { exec } from "node:child_process"
import { createServer } from "node:http"
import { createNodeServerAdapter } from "./adapter.mjs"
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
  let closed = false

  const server = createServer(createNodeServerAdapter(createHandler({ docsDir })))
  wss.attach(server)

  const close = () => {
    if (closed) return
    closed = true
    process.off("SIGINT", onSignal)
    process.off("SIGTERM", onSignal)
    fileWatcher.close()
    wss.close()
    clearState()
    server.closeAllConnections()
    if (server.listening) server.close()
  }
  const onSignal = () => {
    close()
    process.exit(0)
  }
  process.on("SIGINT", onSignal)
  process.on("SIGTERM", onSignal)

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
  return { server, wss, fileWatcher, close }
}
