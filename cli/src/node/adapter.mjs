// node:http ⇄ Fetch adapter: one Request in, one Response out. Bodies are
// streamed to the client; the server is read-only, so request bodies are not
// forwarded.
import { Readable } from "node:stream"

/**
 * @param {(request: Request) => Promise<Response>} handler
 * @returns {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => Promise<void>}
 */
export function createNodeServerAdapter(handler) {
  return async function nodeHandler(req, res) {
    let response
    try {
      response = await handler(toWebRequest(req))
    } catch (err) {
      console.error(err)
      sendText(res, 500, "Internal Server Error")
      return
    }

    res.statusCode = response.status
    if (response.statusText) res.statusMessage = response.statusText
    response.headers.forEach((value, name) => res.setHeader(name, value))

    if (!response.body || req.method === "HEAD") {
      await response.body?.cancel().catch(() => { })
      res.end()
      return
    }

    const body = Readable.fromWeb(/** @type {any} */ (response.body))
    body.on("error", (err) => {
      console.error(err)
      res.destroy(err)
    })
    // The client went away before the body finished: stop reading the file.
    res.on("close", () => {
      if (!res.writableEnded) body.destroy()
    })
    body.pipe(res)
  }
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {Request}
 */
function toWebRequest(req) {
  const host = req.headers.host || "localhost"
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const item of value) headers.append(name, item)
    else headers.set(name, value)
  }
  return new Request(`http://${host}${req.url}`, { method: req.method, headers })
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {string} body
 */
function sendText(res, status, body) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" })
  res.end(body)
}
