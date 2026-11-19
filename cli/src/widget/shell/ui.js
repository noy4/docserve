// UI helpers handed to plugins: mount points, stylesheets, announcements.
import { el } from "../lib/dom.js"

/**
 * @param {object} options
 * @param {ShadowRoot} options.root
 * @param {HTMLElement} options.status   Live region for `announce`.
 * @returns {UiContext}
 */
export function createUi({ root, status }) {
  /** @type {Set<string>} */
  const added = new Set()

  style("/__docserve/widget/widget.css")

  return {
    mountPoint,
    style,
    announce,
  }

  /**
   * Layout-neutral host in the shadow root for plugin UIs.
   * @returns {HTMLElement}
   */
  function mountPoint() {
    const element = el("div", { "data-docserve-mount": "" })
    element.style.display = "contents"
    root.append(element)
    return element
  }

  /**
   * Add a stylesheet inside the shadow root once.
   * @param {string} href
   */
  function style(href) {
    if (added.has(href)) return
    added.add(href)

    root.append(el("link", { rel: "stylesheet", href }))
  }

  /**
   * @param {string} message
   */
  function announce(message) {
    status.textContent = message
  }
}