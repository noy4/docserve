// Widget host
import { createCommands } from "./commands.js"
import { createDocks } from "./docks.js"
import { el } from "./lib/dom.js"
import { createEmitter } from "./lib/emitter.js"
import { connectLive } from "./live.js"
import { createPages } from "./pages.js"
import { createPalette } from "./palette.js"
import { createPlacement } from "./placement.js"
import { createPlugins } from "./plugins.js"
import { createRpc } from "./rpc.js"
import { reloadStyles, settled } from "./styles.js"
import { createUi } from "./ui.js"

/**
 * Create the widget without mounting it.
 * @returns {{ ctx: DocserveContext, start: () => DocserveContext, stop: () => void }}
 */
export function createHost() {
  const script = injectedScript()
  const page = resolvePage(script)
  const docs = resolveDocs(script)

  // element
  const { host, root, status, reveal } = mount()

  // lifecycle state
  /** @type {ReturnType<typeof connectLive> | null} */
  let live = null
  let mounted = false

  // transport
  const rpc = createRpc()
  const pages = createPages({ rpc })
  const { on, emit } = createEmitter()

  // context is filled below, services resolve it when called
  const getContext = () => ctx

  // commands
  const commands = createCommands({ getContext })

  // interface
  const ui = createUi({ root, status })
  const docks = createDocks({ root, getContext })
  const placement = createPlacement({ host, handle: docks.element })
  const palette = createPalette({
    root,
    ui,
    commands: commands.api,
    subscribe: commands.onChange,
  })

  // plugins
  const { use, dispose } = createPlugins(getContext)

  // context
  /** @type {DocserveContext} */
  const ctx = {
    page,
    docs,
    rpc,
    docks,
    commands: commands.api,
    ui,
    on,
    use,
    start,
  }

  return { ctx, start, stop }

  // ---

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
      // reverse order
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
    switch (message.type) {
      case "css":
        reloadStyles([document, root])
        return
      case "change":
        onContentChange(message)
        return
    }
  }

  /**
   * @param {ChangeMessage} message
   */
  function onContentChange(message) {
    if (message.contentSetChanged || message.pages.length)
      pages.invalidate()
    emit("change", message)

    // only reload when this page or the gallery template changed
    if (message.pages.includes(page) || message.templateChanged)
      location.reload()
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

/** The injected module script, when the page was served by docserve. */
function injectedScript() {
  return /** @type {HTMLScriptElement | null} */ (
    document.querySelector('script[src="/__docserve/widget/index.js"]')
  )
}

/** docs-relative path of the page being viewed */
function resolvePage(script) {
  const page = script?.getAttribute("data-page")
  if (page) return page
  return location.pathname.replace(/^\//, "")
}

/** Served folder identity from `data-docs-*`; undefined outside docserve. */
function resolveDocs(script) {
  const name = script?.getAttribute("data-docs-name") || ""
  const path = script?.getAttribute("data-docs-path") || ""
  if (!name && !path) return undefined
  const hue = Number(script?.getAttribute("data-docs-hue"))
  return { name: name || path, path: path || name, hue: Number.isFinite(hue) ? hue : 0 }
}
