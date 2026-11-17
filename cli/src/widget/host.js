// Widget host
import { createCommands } from "./commands.js"
import { createDock } from "./dock.js"
import { el } from "./lib/dom.js"
import { createEmitter } from "./lib/emitter.js"
import { connectLive } from "./live.js"
import { createPages } from "./pages.js"
import { createPalette } from "./palette.js"
import { createPlacement } from "./placement.js"
import { createPlugins } from "./plugins.js"
import { createRpc } from "./rpc.js"
import { createUi } from "./ui.js"

/**
 * Create the widget without mounting it.
 * @returns {{ ctx: DocserveContext, start: () => DocserveContext, stop: () => void }}
 */
export function createHost() {
  const page = resolvePage()

  // element
  const { host, root, status, reveal } = mount()

  // services
  const rpc = createRpc()
  const pages = createPages({ rpc })
  const dock = createDock({ root, getContext: () => ctx })
  const commands = createCommands({ getContext: () => ctx })
  const placement = createPlacement({ host, handle: dock.element })
  const { on, emit } = createEmitter()
  const ui = createUi({ root, status })

  const palette = createPalette({
    root,
    ui,
    commands: commands.api,
    subscribe: commands.onChange,
  })

  // context
  /** @type {DocserveContext} */
  let ctx
  const { use, dispose } = createPlugins(() => ctx)
  ctx = {
    page,
    rpc,
    dock,
    commands: commands.api,
    ui,
    on,
    use,
    start,
  }

  // lifecycle state
  /** @type {ReturnType<typeof connectLive> | null} */
  let live = null
  let mounted = false

  return { ctx, start, stop }

  function start() {
    if (mounted) return ctx
    mounted = true

    document.documentElement.toggleAttribute("data-docserve-widget", true)
    document.body.append(host)
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

  function stop() {
    live?.close()
    live = null
    if (mounted) {
      placement.destroy()
      palette.destroy()
      commands.destroy()
      document.documentElement.toggleAttribute("data-docserve-widget", false)
      host.toggleAttribute("data-ready", false)
      host.remove()
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
    const own = /** @type {HTMLLinkElement | null} */ (root.querySelector('link[rel="stylesheet"]'))
    if (own) own.href = `/__docserve/widget/widget.css?__docserve_rev=${stamp}`
  }
}

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
 * @param {HTMLLinkElement} link
 * @returns {Promise<void>}
 */
function settled(link) {
  if (link.sheet) return Promise.resolve()
  return new Promise((resolve) => {
    link.addEventListener("load", () => resolve(), { once: true })
    link.addEventListener("error", () => resolve(), { once: true })
  })
}

/** Shadow host, its root, the live region and the reveal hook. */
function mount() {
  const host = el("div", { id: "docserve-dock-host", "data-docserve-widget": "" })
  const root = host.attachShadow({ mode: "open" })
  root.append(el("style", { text: CRITICAL_CSS }))
  const status = el("span", { class: "docserve-dock__status", role: "status", "aria-live": "polite" })
  root.append(status)
  return { host, root, status, reveal }

  // Show the widget only once its stylesheets are applied, so nothing appears
  // unstyled. The timeout covers a stylesheet that never settles.
  function reveal() {
    const done = () => host.toggleAttribute("data-ready", true)
    const links = [...root.querySelectorAll('link[rel~="stylesheet"]')]
    Promise.all(links.map(settled)).then(done)
    setTimeout(done, 500)
  }
}

/** docs-relative path of the page being viewed */
function resolvePage() {
  const script = document.querySelector('script[src="/__docserve/widget/index.js"][data-page]')
  const page = script?.getAttribute("data-page")
  if (page) return page
  return location.pathname.replace(/^\//, "")
}