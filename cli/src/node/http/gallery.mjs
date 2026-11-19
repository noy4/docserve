// The gallery SPA shell served at / and /index.html. Every other HTML file
// comes from the docs folder and is injected instead.
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { docsInfo } from "../docs/info.mjs"
import { text } from "./response.mjs"
import { GALLERY_DIST_DIR } from "../paths.mjs"

const SHELL = join(GALLERY_DIST_DIR, "index.html")

/**
 * @param {string} docsDir
 * @returns {Promise<Response>}
 */
export async function galleryResponse(docsDir) {
  const { name, path, hue } = docsInfo(docsDir)

  let html
  try {
    html = await readFile(SHELL, "utf8")
  } catch {
    return text("Gallery build missing: run `npm run build`", 503, { "cache-control": "no-store" })
  }

  html = html
    .replaceAll("__DOCS_NAME__", escapeHtml(name))
    .replaceAll("__DOCS_PATH__", escapeHtml(path))
    .replaceAll("__DOCS_HUE__", String(hue))

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } })
}

/**
 * Escape text for an HTML text node or a double-quoted attribute.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}