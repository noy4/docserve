// UI helpers handed to plugins: panels, stylesheets, announcements.
import { el } from "./lib/dom.js"

/**
 * What core gets back: the plugin-facing API plus the style-readiness hook,
 * which plugins have no use for.
 * @typedef {UiApi & { whenStylesReady: () => Promise<void> }} UiHandle
 */

/**
 * @param {object} options
 * @param {ShadowRoot} options.root
 * @param {HTMLElement} options.status   Live region for `announce`.
 * @returns {UiHandle}
 */
export function createUi({ root, status }) {
  const panels = createPanels(root)
  /** @type {Set<string>} */
  const added = new Set()
  /** @type {Set<Promise<void>>} */
  const loads = new Set()

  style("/__docserve/widget/widget.css")

  return {
    panel: panels.add,
    style,
    announce,
    whenStylesReady,
  }

  /**
   * Add a stylesheet inside the shadow root once.
   * @param {string} href
   */
  function style(href) {
    if (added.has(href)) return
    added.add(href)

    const link = el("link", { rel: "stylesheet", href })
    const load = new Promise((resolve) => {
      link.addEventListener("load", () => resolve(), { once: true })
      link.addEventListener("error", () => resolve(), { once: true })
    })
    loads.add(load)
    root.append(link)
  }

  /**
   * Resolves once every stylesheet added so far has loaded or failed.
   * @returns {Promise<void>}
   */
  function whenStylesReady() {
    return Promise.all([...loads]).then(() => {})
  }

  /**
   * @param {string} message
   */
  function announce(message) {
    status.textContent = message
  }
}

/**
 * Side panels. An open left panel shifts the page with a CSS variable.
 * @param {ShadowRoot} root
 * @returns {{ add: (options: PanelOptions) => PanelHandle }}
 */
function createPanels(root) {
  /** @type {PanelHandle[]} */
  const panels = []

  return { add }

  /**
   * @param {PanelOptions} options
   * @returns {PanelHandle}
   */
  function add(options) {
    const side = options.side ?? "left"
    const width = options.width ?? "280px"
    const element = options.element
    element.classList.add("docserve-panel")
    element.dataset.side = side
    element.style.width = width
    element.toggleAttribute("data-open", Boolean(options.open))
    root.append(element)

    const handle = {
      element,
      side,
      width,
      isOpen() {
        return element.hasAttribute("data-open")
      },
      setOpen(open) {
        element.toggleAttribute("data-open", open)
        syncOffset()
      },
      remove() {
        const index = panels.indexOf(handle)
        if (index !== -1) panels.splice(index, 1)
        element.remove()
        syncOffset()
      },
    }
    panels.push(handle)
    syncOffset()
    return handle
  }

  // The last open left panel wins; right panels never shift the page.
  function syncOffset() {
    const open = panels.filter((panel) => panel.side === "left" && panel.isOpen()).at(-1)
    const html = document.documentElement
    if (open) {
      html.style.setProperty("--docserve-panel-left", open.width)
      html.toggleAttribute("data-docserve-panel-left", true)
    } else {
      html.style.removeProperty("--docserve-panel-left")
      html.toggleAttribute("data-docserve-panel-left", false)
    }
  }
}