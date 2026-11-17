// Widget host: shadow root, lifecycle, context assembly and the live connection.
import { createDock } from "./dock.js"
import { el } from "./lib/dom.js"
import { createEmitter } from "./lib/emitter.js"
import { connectLive } from "./live.js"
import { createPages } from "./pages.js"
import { createPlacement } from "./placement.js"
import { createPlugins } from "./plugins.js"
import { createRpc } from "./rpc.js"
import { createUi } from "./ui.js"

// Inline `<style>` in the shadow root: keeps the host out of the layout and
// hidden until `reveal()` sets `data-ready`. The rules after it are only a
// fallback for a stylesheet that never loads.
const CRITICAL_CSS = [
  ":host{display:none;position:fixed;right:16px;bottom:16px;z-index:2147483647;margin:0;padding:0;line-height:0}",
  ":host([data-ready]){display:block}",
  ".docserve-dock{display:flex;align-items:center}",
  ".docserve-dock__button{display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;background:none;color:inherit}",
  ".docserve-dock__status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}",
].join("")

/**
 * Create the widget without mounting it.
 * @returns {{ ctx: DocserveContext, start: () => DocserveContext, stop: () => void }}
 */
export function createHost() {
  const page = resolvePage()

  // shadow host keeps page css out
  const element = el("div", { id: "docserve-dock-host", "data-docserve-widget": "" })
  const shadow = element.attachShadow({ mode: "open" })
  shadow.append(el("style", { text: CRITICAL_CSS }))

  // live region for announcements
  const status = el("span", { class: "docserve-dock__status", role: "status", "aria-live": "polite" })
  shadow.append(status)

  // core services
  const rpc = createRpc()
  const pages = createPages({ rpc })
  const dock = createDock({ host: shadow, getContext: () => ctx })
  const placement = createPlacement({ element, handle: dock.element })
  const { on, emit } = createEmitter()
  const ui = createUi({ host: shadow, status })
  ui.style("/__docserve/widget/widget.css")

  // public surface, built before plugins run
  /** @type {DocserveContext} */
  let ctx
  const { use, dispose } = createPlugins(() => ctx)
  ctx = { page, rpc, dock, ui, on, use, start }

  // lifecycle state
  /** @type {ReturnType<typeof connectLive> | null} */
  let live = null
  let mounted = false

  return { ctx, start, stop }

  function start() {
    if (mounted) return ctx
    mounted = true

    document.documentElement.toggleAttribute("data-docserve-widget", true)
    document.body.append(element)
    reveal()
    emit("start")

    live = connectLive({
      onOpen() {
        pages.invalidate()
        emit("open")
      },
      onMessage: onLiveMessage,
    })
    return ctx
  }

  // Show the widget only once its stylesheets are applied, so nothing appears
  // unstyled. The timeout covers a stylesheet that never settles.
  function reveal() {
    const done = () => element.toggleAttribute("data-ready", true)
    ui.whenStylesReady().then(done)
    setTimeout(done, 500)
  }

  function stop() {
    live?.close()
    live = null
    if (mounted) {
      placement.destroy()
      document.documentElement.toggleAttribute("data-docserve-widget", false)
      element.toggleAttribute("data-ready", false)
      element.remove()
      mounted = false
    }
    dispose()
  }

  /**
   * @param {LiveMessage} message
   */
  function onLiveMessage(message) {
    if (message.type === "css") {
      refreshStyles()
      return
    }

    if (message.contentSetChanged || message.pages.length) pages.invalidate()
    emit("change", message)

    // only reload when this page changed
    if (message.pages.includes(page)) {
      location.reload()
      return
    }
    if (message.templateChanged) location.reload()
  }

  // re-fetch same-origin stylesheets, including the widget's own
  function refreshStyles() {
    const stamp = String(Date.now())
    for (const link of document.querySelectorAll('link[rel~="stylesheet"]')) {
      if (!(link instanceof HTMLLinkElement)) continue
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin) continue
      url.searchParams.set("__docserve_rev", stamp)
      link.href = url.href
    }
    const own = /** @type {HTMLLinkElement | null} */ (shadow.querySelector('link[rel="stylesheet"]'))
    if (own) own.href = `/__docserve/widget/widget.css?__docserve_rev=${stamp}`
  }
}

/** docs-relative path of the page being viewed */
function resolvePage() {
  const script = document.querySelector('script[src="/__docserve/widget/index.js"][data-page]')
  const page = script?.getAttribute("data-page")
  if (page) return page
  return location.pathname.replace(/^\//, "")
}