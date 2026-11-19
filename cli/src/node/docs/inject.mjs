// Injection: every HTML response from the docs root gets the widget tags before
// the last </body>. The gallery template is served separately and never reaches
// this module.
import { docsInfo } from "./info.mjs"

export const WS_PATH = "/__reload"

const MARKER = "<!--docserve-widget-->"
const SCRIPT_SRC = "/__docserve/widget/index.js"

/**
 * Append the widget once. Idempotent: a second pass over the same document is a
 * no-op. Without a </body> the tags are appended at the end.
 * @param {string} html
 * @param {string} page     Docs-relative path, e.g. `guides/intro.html`.
 * @param {string} [docsDir]
 * @returns {string}
 */
export function injectIntoHtml(html, page, docsDir = "") {
  if (html.includes(MARKER)) return html

  const docs = docsInfo(docsDir)
  const tags = [
    MARKER,
    '<link rel="stylesheet" href="/__docserve/widget/widget.css" data-docserve-widget>',
    `<script type="module" src="${SCRIPT_SRC}" data-docserve-widget data-page="${escapeAttribute(page)}" data-docs-name="${escapeAttribute(docs.name)}" data-docs-path="${escapeAttribute(docs.path)}" data-docs-hue="${docs.hue}"></script>`,
  ].join("\n")

  const index = html.toLowerCase().lastIndexOf("</body>")
  return index === -1 ? `${html}\n${tags}` : `${html.slice(0, index)}${tags}\n${html.slice(index)}`
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
