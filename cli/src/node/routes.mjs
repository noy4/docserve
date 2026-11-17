// HTTP routing: the gallery, the docs folder, the widget assets and the page
// list. Nothing here knows about listening or signals.
import { readFile, stat } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { MIME, serveAsset } from "./assets.mjs"
import { apiFiles } from "./files.mjs"
import { galleryResponse } from "./gallery.mjs"
import { injectIntoHtml } from "./inject.mjs"
import { isWithin, normalizedRelative } from "./scan.mjs"

const WIDGET_DIR = resolve(import.meta.dirname, "..", "widget")
const PLUGINS_DIR = resolve(import.meta.dirname, "..", "plugins")

/**
 * @param {{ docsDir: string }} options
 * @returns {(request: Request) => Promise<Response>}
 */
export function createHandler({ docsDir }) {
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

    // widget and plugin sources, re-read per request so edits show up live
    if (url.pathname.startsWith("/__docserve/widget/"))
      return serveAsset(WIDGET_DIR, url.pathname.slice("/__docserve/widget/".length))
    if (url.pathname.startsWith("/__docserve/plugins/"))
      return serveAsset(PLUGINS_DIR, url.pathname.slice("/__docserve/plugins/".length))
    if (url.pathname.startsWith("/__docserve/"))
      return new Response("Not Found", { status: 404 })

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

    // /sub/ → /sub/index.html
    const target = pathname.endsWith("/") ? `${pathname}index.html` : pathname
    const path = resolve(docsDir, target.slice(1))
    if (!isWithin(docsDir, path)) {
      return new Response("Forbidden", { status: 403 })
    }

    try {
      const body = await readFile(path)
      const type = MIME[extname(path).toLowerCase()] || "application/octet-stream"
      // inject the widget into docsDir pages only; the gallery template ships its own client
      if (type === "text/html") {
        const html = injectIntoHtml(body.toString(), normalizedRelative(docsDir, path))
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
      }
      return new Response(body, { headers: { "content-type": type } })
    } catch {
      // Redirect /sub → /sub/
      try {
        if ((await stat(path)).isDirectory()) {
          return Response.redirect(new URL(`${url.pathname}/`, url), 301)
        }
      } catch { }
      return new Response("Not Found", { status: 404 })
    }
  }
}