// The gallery template served at / and /index.html. Every other HTML file comes
// from the docs folder and is injected instead.
import { readFile } from "node:fs/promises"
import { docsInfo } from "./docs-info.mjs"
import { text } from "./http.mjs"
import { GALLERY_TEMPLATE } from "./paths.mjs"

/**
 * @param {string} docsDir
 * @returns {Promise<Response>}
 */
export async function galleryResponse(docsDir) {
  try {
    const { name, path, hue } = docsInfo(docsDir)
    let html = await readFile(GALLERY_TEMPLATE, "utf8")
    html = html
      .replaceAll("__DOCS_DIR_NAME__", escapeHtml(name))
      .replaceAll("__DOCS_DIR__", escapeHtml(path))
      .replaceAll("__FAVICON_HUE__", String(hue))
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
  } catch {
    return text("Gallery template missing", 500)
  }
}

/**
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}
