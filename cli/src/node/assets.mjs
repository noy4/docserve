// Widget and plugin assets: the same static handler as the docs tree, rooted
// at src/widget and src/plugins and read per request so edits need no restart.
import { createStaticHandler } from "./serve-static.mjs"

export { MIME } from "./serve-static.mjs"

/** @type {Map<string, (request: Request) => Promise<Response | null>>} */
const handlers = new Map()

/**
 * @param {string} root
 */
function handlerFor(root) {
  let handler = handlers.get(root)
  if (!handler) {
    handler = createStaticHandler({ root, headers: { "cache-control": "no-store" } })
    handlers.set(root, handler)
  }
  return handler
}

/**
 * Serve a file from the widget or plugin tree by its decoded relative path;
 * symlinks must stay inside root.
 * @param {string} root
 * @param {string} relative
 * @returns {Promise<Response>}
 */
export async function serveAsset(root, relative) {
  if (!relative) return new Response("Not Found", { status: 404 })

  // Re-encode segment-wise so the handler's single decode yields the input.
  const encoded = relative.split("/").map(encodeURIComponent).join("/")
  const response = await handlerFor(root)(new Request(`http://localhost/${encoded}`))
  return response ?? new Response("Not Found", { status: 404 })
}
