// HTTP routing: an ordered table of handlers over one docs static handler.
// Nothing here knows about listening, signals or sockets.
import { resolve } from "node:path"
import { serveAsset } from "./assets.mjs"
import { apiFiles } from "./files.mjs"
import { galleryResponse } from "./gallery.mjs"
import { injectIntoHtml } from "./inject.mjs"
import { createStaticHandler } from "./serve-static.mjs"

const WIDGET_DIR = resolve(import.meta.dirname, "..", "widget")
const PLUGINS_DIR = resolve(import.meta.dirname, "..", "plugins")
const INTERNAL_PREFIX = "/__docserve/"
const WIDGET_PREFIX = `${INTERNAL_PREFIX}widget/`
const PLUGINS_PREFIX = `${INTERNAL_PREFIX}plugins/`

/**
 * @param {{ docsDir: string }} options
 * @returns {(request: Request) => Promise<Response>}
 */
export function createHandler({ docsDir }) {
  // Every other HTML response is injected; the gallery template is not.
  const docs = createStaticHandler({
    root: docsDir,
    headers: { "cache-control": "no-store" },
    transform: (html, relative) => injectIntoHtml(html, relative, docsDir),
  })

  /** @type {Array<{ match: (pathname: string) => boolean, handle: (request: Request, url: URL) => Promise<Response> }>} */
  const routes = [
    { match: (pathname) => pathname === "/api/files", handle: serveFiles },
    { match: (pathname) => pathname.startsWith(INTERNAL_PREFIX), handle: serveInternal },
    { match: (pathname) => pathname === "/" || pathname === "/index.html", handle: serveGallery },
    { match: () => true, handle: serveDocs },
  ]

  return async function handler(request) {
    const url = new URL(request.url)
    const route = routes.find((candidate) => candidate.match(url.pathname))
    return route.handle(request, url)
  }

  /**
   * @returns {Promise<Response>}
   */
  async function serveFiles() {
    try {
      return Response.json(await apiFiles(docsDir), { headers: { "cache-control": "no-store" } })
    } catch (err) {
      console.error(err)
      return Response.json([], { headers: { "cache-control": "no-store" } })
    }
  }

  /**
   * Widget and plugin sources, re-read per request so edits show up live.
   * @param {Request} request
   * @param {URL} url
   * @returns {Promise<Response>}
   */
  async function serveInternal(request, url) {
    if (url.pathname.startsWith(WIDGET_PREFIX))
      return serveAsset(WIDGET_DIR, url.pathname.slice(WIDGET_PREFIX.length))
    if (url.pathname.startsWith(PLUGINS_PREFIX))
      return serveAsset(PLUGINS_DIR, url.pathname.slice(PLUGINS_PREFIX.length))
    return new Response("Not Found", { status: 404 })
  }

  /**
   * @returns {Promise<Response>}
   */
  async function serveGallery() {
    return galleryResponse(docsDir)
  }

  /**
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async function serveDocs(request) {
    return (await docs(request)) ?? new Response("Not Found", { status: 404 })
  }
}
