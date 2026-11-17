// The gallery template served at / and /index.html. Every other HTML file comes
// from the docs folder and is injected instead.
import { readFile } from "node:fs/promises"
import os from "node:os"
import { basename, resolve } from "node:path"

export const INDEX_TEMPLATE = resolve(import.meta.dirname, "..", "..", "index.html")

/**
 * @param {string} docsDir
 * @returns {Promise<Response>}
 */
export async function galleryResponse(docsDir) {
  try {
    let html = await readFile(INDEX_TEMPLATE, "utf8")
    html = html
      .replaceAll("__DOCS_DIR_NAME__", escapeHtml(basename(docsDir) || docsDir))
      .replaceAll("__DOCS_DIR__", escapeHtml(displayPath(docsDir)))
      .replaceAll("__FAVICON_HUE__", String(faviconHue(docsDir)))
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
  } catch {
    return new Response("Gallery template missing", { status: 500 })
  }
}

// Collapse the home directory prefix to ~ for display.
function displayPath(p) {
  const home = os.homedir()
  return p.startsWith(`${home}/`) ? `~${p.slice(home.length)}` : p
}

// Deterministic hue for the folder favicon: the same path always yields the same color.
function faviconHue(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return ((h % 360) + 360) % 360
}

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}