// UI helpers handed to plugins: panels, stylesheets, announcements.
import { el } from "./dom.js"

/**
 * @param {object} options
 * @param {ShadowRoot} options.host
 * @param {HTMLElement} options.status   Live region for `announce`.
 * @returns {UiApi}
 */
export function createUi({ host, status }) {
  const panels = createPanels(host)
  /** @type {Set<string>} */
  const styles = new Set()

  return {
    panel: panels.add,

    style(href) {
      if (styles.has(href)) return
      styles.add(href)
      host.append(el("link", { rel: "stylesheet", href }))
    },

    announce(message) {
      status.textContent = message
    },
  }
}

/**
 * Side panels. An open left panel shifts the page with a CSS variable.
 * @param {ShadowRoot} host
 * @returns {{ add: (options: PanelOptions) => PanelHandle }}
 */
function createPanels(host) {
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
    host.append(element)

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
    const root = document.documentElement
    if (open) {
      root.style.setProperty("--docserve-panel-left", open.width)
      root.toggleAttribute("data-docserve-panel-left", true)
    } else {
      root.style.removeProperty("--docserve-panel-left")
      root.toggleAttribute("data-docserve-panel-left", false)
    }
  }
}