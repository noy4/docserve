// Static file serving shared by the docs root, the widget tree and the plugin
// tree: one containment check, one MIME table, streaming bodies.
//
// Path flow: decode once → resolve inside root → canonical (realpath) check →
// directory index → 301 for a directory without its trailing slash.
import { createReadStream } from "node:fs"
import { readFile, realpath, stat } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { Readable } from "node:stream"
import { isWithin, normalizedRelative } from "./scan.mjs"

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
 * @param {string} path
 * @returns {string}
 */
export function contentTypeFor(path) {
  const type = MIME[extname(path).toLowerCase()] || "application/octet-stream"
  return type === "text/html" ? "text/html; charset=utf-8" : type
}

/**
 * @typedef {object} StaticHandlerOptions
 * @property {string} root                    Directory files are served from.
 * @property {string[]} [indexNames]          Directory index candidates.
 * @property {Record<string, string>} [headers] Extra response headers.
 * @property {(body: string, relative: string) => string} [transform] HTML rewrite.
 */

/**
 * Returns a handler that maps a Request to a Response, or null on a miss so a
 * router can fall through to its own 404.
 * @param {StaticHandlerOptions} options
 * @returns {(request: Request) => Promise<Response | null>}
 */
export function createStaticHandler({ root: rootDir, indexNames = ["index.html"], headers = {}, transform }) {
  const root = resolve(rootDir)
  const realRoot = realpath(root).catch(() => root)

  return async function serve(request) {
    const method = request.method || "GET"
    if (method !== "GET" && method !== "HEAD") return plain("Method Not Allowed", 405)

    const url = new URL(request.url)
    let pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return plain("Bad Request", 400)
    }
    if (pathname.includes("\0")) return plain("Bad Request", 400)

    const abs = resolve(root, pathname.replace(/^\/+/, ""))
    if (!isWithin(root, abs)) return plain("Forbidden", 403)

    const real = await realRoot
    const hasSlash = pathname.endsWith("/")
    let file = await statFile(abs, real)

    if (!file) {
      const isDir = await isDirectory(abs)
      // /sub → /sub/ so relative links in index.html resolve; /sub/ serves it.
      if (isDir && !hasSlash) return redirect(url)
      if (isDir || hasSlash) {
        for (const name of indexNames) {
          file = await statFile(resolve(abs, name), real)
          if (file) break
        }
      }
      if (!file) return null
    }

    const responseHeaders = new Headers(headers)
    responseHeaders.set("content-type", contentTypeFor(file.abs))
    responseHeaders.set("content-length", String(file.size))
    responseHeaders.set("last-modified", file.mtime.toUTCString())
    if (method === "HEAD") return new Response(null, { status: 200, headers: responseHeaders })

    const type = responseHeaders.get("content-type") || ""
    if (transform && type.startsWith("text/html")) {
      const html = transform(await readFile(file.abs, "utf8"), normalizedRelative(root, file.abs))
      responseHeaders.set("content-length", String(Buffer.byteLength(html)))
      return new Response(html, { status: 200, headers: responseHeaders })
    }

    return new Response(Readable.toWeb(createReadStream(file.abs)), { status: 200, headers: responseHeaders })
  }
}

/**
 * @param {string} abs
 * @param {string} realRoot
 * @returns {Promise<{ abs: string, size: number, mtime: Date } | null>}
 */
async function statFile(abs, realRoot) {
  try {
    const s = await stat(abs)
    if (!s.isFile()) return null
    const real = await realpath(abs)
    if (real !== realRoot && !real.startsWith(realRoot + sep)) return null
    return { abs, size: s.size, mtime: s.mtime }
  } catch {
    return null
  }
}

/**
 * @param {string} abs
 * @returns {Promise<boolean>}
 */
async function isDirectory(abs) {
  try {
    return (await stat(abs)).isDirectory()
  } catch {
    return false
  }
}

/**
 * @param {URL} url
 * @returns {Response}
 */
function redirect(url) {
  const location = new URL(`${url.pathname}/${url.search}`, url)
  return new Response(null, { status: 301, headers: { location: location.href } })
}

/**
 * @param {string} body
 * @param {number} status
 * @returns {Response}
 */
function plain(body, status) {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } })
}
