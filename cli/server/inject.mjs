// Injection: every text/html response served from docsDir gets one client script
// before the last </body> (appended at the end if the tag is missing). The script
// exits immediately inside iframes, so previews get neither part; the gallery
// template ships its own client. The client template is loaded once at startup.
import { readFileSync } from "node:fs"

export const WS_PATH = "/__reload"

const clientTemplate = readFileSync(new URL("./inject.html", import.meta.url), "utf8")

export function injectIntoHtml(html, pageId, absPath) {
  const idx = html.toLowerCase().lastIndexOf("</body>")
  if (idx === -1) return html + clientJs(pageId, absPath)
  return html.slice(0, idx) + clientJs(pageId, absPath) + html.slice(idx)
}

function clientJs(pageId, absPath) {
  const values = {
    PAGE_ID: JSON.stringify(pageId).replaceAll("<", "\\u003c"),
    ABS_PATH: JSON.stringify(absPath).replaceAll("<", "\\u003c"),
    WS_PATH: JSON.stringify(WS_PATH),
  }
  return clientTemplate.replace(/__DOCSERVE_(PAGE_ID|ABS_PATH|WS_PATH)__/g, (_, key) => values[key])
}
