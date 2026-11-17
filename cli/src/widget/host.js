// Widget host: shadow root, lifecycle, context assembly and the live connection.
import { createDock } from "./dock.js"
import { el } from "./dom.js"
import { createEmitter } from "./emitter.js"
import { connectLive } from "./live.js"
import { createPages } from "./pages.js"
import { createPlugins } from "./plugins.js"
import { createRpc } from "./rpc.js"
import { createUi } from "./ui.js"

const CRITICAL_CSS = ":host{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483647;margin:0;padding:0;line-height:0}"

/**
 * Create the widget without mounting it.
 * @returns {{ ctx: DocserveContext, start: () => DocserveContext, stop: () => void }}
 */
export function createHost() {
  const page = resolvePage()

  // shadow host keeps page css out
  const element = el("div", { id: "docserve-dock-host", "data-docserve-widget": "" })
  const shadow = element.attachShadow({ mode: "open" })
  shadow.append(
    el("style", { text: CRITICAL_CSS }),
    el("link", { rel: "stylesheet", href: "/__docserve/widget/widget.css" }),
  )

  // live region for announcements
  const status = el("span", { class: "docserve-dock__status", role: "status", "aria-live": "polite" })
  shadow.append(status)

  // core services
  const rpc = createRpc()
  const pages = createPages({ rpc })
  const dock = createDock({ host: shadow, getContext: () => ctx })
  const { on, emit } = createEmitter()
  const ui = createUi({ host: shadow, status })

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

  function stop() {
    live?.close()
    live = null
    if (mounted) {
      document.documentElement.toggleAttribute("data-docserve-widget", false)
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