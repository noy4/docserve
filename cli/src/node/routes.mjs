// HTTP routing: an ordered table of handlers over one docs static handler.
// Nothing here knows about listening, signals or sockets.
import { serveAsset } from "./assets.mjs"
import { galleryResponse } from "./gallery.mjs"
import { injectIntoHtml } from "./inject.mjs"
import { PLUGINS_SOURCE_DIR, WIDGET_DIST_DIR, WIDGET_SOURCE_DIR } from "./paths.mjs"
import { createStaticHandler } from "./serve-static.mjs"

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
   * Widget bundle and plugin sources, read per request (widget JS comes from dist).
   * @param {Request} request
   * @param {URL} url
   * @returns {Promise<Response>}
   */
  async function serveInternal(request, url) {
    if (url.pathname.startsWith(WIDGET_PREFIX))
      return serveWidget(url.pathname.slice(WIDGET_PREFIX.length))
    if (url.pathname.startsWith(PLUGINS_PREFIX))
      return serveAsset(PLUGINS_SOURCE_DIR, url.pathname.slice(PLUGINS_PREFIX.length))
    return new Response("Not Found", { status: 404 })
  }

  /**
   * Built widget first, source files (CSS) as the fallback. A JS request that
   * misses the build is an error: the source entry now has bare imports.
   * @param {string} relative
   * @returns {Promise<Response>}
   */
  async function serveWidget(relative) {
    if (!relative) return new Response("Not Found", { status: 404 })

    const built = await serveAsset(WIDGET_DIST_DIR, relative)
    if (built.status !== 404) return built

    if (/\.m?js$/.test(relative)) {
      return new Response("Widget bundle missing: run `pnpm -C cli build`", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      })
    }

    return serveAsset(WIDGET_SOURCE_DIR, relative)
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
