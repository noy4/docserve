// Static assets for the injected widget and its plugins. Files are read per
// request with no-store, so edits show up without restarting the server.
import { readFile, realpath, stat } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { isWithin } from "./scan.mjs"

export const MIME = {
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

/**
 * Serve a file from the widget or plugin tree; symlinks must stay inside root.
 * @param {string} root
 * @param {string} relative
 * @returns {Promise<Response>}
 */
export async function serveAsset(root, relative) {
  if (!relative || relative.includes("\0")) return new Response("Not Found", { status: 404 })

  let requested
  try {
    requested = decodeURIComponent(relative)
  } catch {
    return new Response("Bad Request", { status: 400 })
  }

  const target = resolve(root, requested)
  if (!isWithin(root, target)) return new Response("Forbidden", { status: 403 })

  try {
    const real = await realpath(target)
    if (!isWithin(await realpath(root), real)) return new Response("Forbidden", { status: 403 })
    if (!(await stat(real)).isFile()) return new Response("Not Found", { status: 404 })

    const type = MIME[extname(real).toLowerCase()] || "application/octet-stream"
    return new Response(await readFile(real), {
      headers: { "content-type": type, "cache-control": "no-store" },
    })
  } catch {
    return new Response("Not Found", { status: 404 })
  }
}