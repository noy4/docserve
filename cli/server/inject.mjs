// Injection: every text/html response served from docsDir gets one client script
// before the last </body> (appended at the end if the tag is missing). The script
// exits immediately inside iframes, so previews get neither part; the gallery
// template ships its own client.

export const WS_PATH = "/__reload"

export function injectIntoHtml(html, pageId, absPath) {
  const idx = html.toLowerCase().lastIndexOf("</body>")
  if (idx === -1) return html + clientJs(pageId, absPath)
  return html.slice(0, idx) + clientJs(pageId, absPath) + html.slice(idx)
}

function clientJs(pageId, absPath) {
  return `<script>
(() => {
  // iframes: no reload loop from dropped sockets
  if (window.self !== window.top) return
  const pageId = ${JSON.stringify(pageId).replaceAll("<", "\\u003c")}
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  const ws = new WebSocket(proto + "//" + location.host + "${WS_PATH}")
  ws.addEventListener("message", (e) => {
    let change
    try { change = JSON.parse(e.data) } catch { return }
    if (change?.type === "change" && Array.isArray(change.pages) && change.pages.includes(pageId)) {
      location.reload()
    }
  })
  ws.addEventListener("close", () => setTimeout(() => location.reload(), 1000))

  const absPath = ${JSON.stringify(absPath).replaceAll("<", "\\u003c")}
  const COPY = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  const btn = document.createElement("button")
  btn.type = "button"
  btn.title = absPath
  btn.style.cssText = "all:initial;position:fixed;right:14px;bottom:14px;z-index:2147483647;width:28px;height:28px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(15,17,23,.82);color:#e6e8ee;cursor:pointer;opacity:.55;transition:opacity .15s ease,color .15s ease"
  btn.innerHTML = COPY
  btn.addEventListener("mouseenter", () => { btn.style.opacity = "1" })
  btn.addEventListener("mouseleave", () => { btn.style.opacity = ".55" })
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(absPath)
      btn.innerHTML = CHECK
      btn.style.color = "#4ade80"
      setTimeout(() => {
        btn.innerHTML = COPY
        btn.style.color = "#e6e8ee"
      }, 1200)
    } catch {}
  })
  document.body.appendChild(btn)
})()
</script>`
}
