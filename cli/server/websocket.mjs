// Minimal WebSocket server (RFC 6455 subset: handshake + text frames + ping/pong,
// zero deps). Broadcast payloads are JSON-encoded text frames.
import { createHash } from "node:crypto"

export class WebSocketServer {
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

  close() {
    for (const socket of this.clients) {
      try {
        socket.destroy()
      } catch {}
    }
    this.clients.clear()
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
