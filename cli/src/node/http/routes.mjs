// h3 route registration: internal assets, the gallery, and one docs static
// handler. Nothing here knows about listening, signals or sockets.
import { serveAsset } from "./assets.mjs"
import { galleryResponse } from "./gallery.mjs"
import { notFound, text } from "./response.mjs"
import { injectIntoHtml } from "../docs/inject.mjs"
import { PLUGINS_SOURCE_DIR, GALLERY_DIST_DIR, WIDGET_DIST_DIR, WIDGET_SOURCE_DIR } from "../paths.mjs"
import { createStaticHandler } from "./serve-static.mjs"

const INTERNAL_PREFIX = "/__docserve/"
const WIDGET_PREFIX = `${INTERNAL_PREFIX}widget/`
const PLUGINS_PREFIX = `${INTERNAL_PREFIX}plugins/`
const GALLERY_PREFIX = `${INTERNAL_PREFIX}gallery/`

/**
 * @param {import("h3/node").H3} app
 * @param {{ docsDir: string }} options
 */
export function registerRoutes(app, { docsDir }) {
  const docs = createStaticHandler({
    root: docsDir,
    headers: { "cache-control": "no-store" },
    transform: (html, relative) => injectIntoHtml(html, relative, docsDir),
  })

  app.get(`${WIDGET_PREFIX}**`, (event) => serveWidget(event.url.pathname.slice(WIDGET_PREFIX.length)))

  app.get(`${PLUGINS_PREFIX}**`, (event) => serveAsset(PLUGINS_SOURCE_DIR, event.url.pathname.slice(PLUGINS_PREFIX.length)))

  app.get(`${GALLERY_PREFIX}**`, (event) => serveAsset(GALLERY_DIST_DIR, event.url.pathname.slice(GALLERY_PREFIX.length)))

  app.all(`${INTERNAL_PREFIX}**`, () => notFound())

  app.get("/", () => galleryResponse(docsDir))
  app.get("/index.html", () => galleryResponse(docsDir))

  app.all("/**", async (event) => (await docs(event.req)) ?? notFound())
}

/**
 * Built widget first, source files (CSS) as the fallback. A JS request that
 * misses the build is an error: the source entry now has bare imports.
 * @param {string} relative
 * @returns {Promise<Response>}
 */
async function serveWidget(relative) {
  if (!relative) return notFound()

  const built = await serveAsset(WIDGET_DIST_DIR, relative)
  if (built.status !== 404) return built

  if (/\.m?js$/.test(relative)) {
    return text("Widget bundle missing: run `pnpm -C cli build`", 503, {
      "cache-control": "no-store",
    })
  }

  return serveAsset(WIDGET_SOURCE_DIR, relative)
}
