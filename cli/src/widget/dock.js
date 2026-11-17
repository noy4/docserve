// The dock: one pill that every plugin contributes items to. An item either
// runs a command or is a link.
import { formatKey } from "./commands.js"
import { el } from "./lib/dom.js"

/**
 * Build the dock and mount it into the shadow root.
 * @param {object} options
 * @param {ShadowRoot} options.host
 * @param {() => DocserveContext} options.getContext  Resolved when an item is clicked.
 * @returns {DockHandle}
 */
export function createDock({ host, getContext }) {
  /** @type {DockItem[]} */
  const items = []
  const element = el("div", { class: "docserve-dock", role: "toolbar", "aria-label": "docserve" })
  /** @type {Map<string, DockItemHandle>} */
  const handles = new Map()

  host.append(element)
  render()

  return {
    element,
    add,
    remove,
    items() {
      return [...items]
    },
  }

  /**
   * @param {DockItem} item
   * @returns {DockItemHandle}
   */
  function add(item) {
    if (typeof item?.id !== "string" || !item.id) throw new TypeError("dock.add expects an item with an id")
    if (handles.has(item.id)) throw new Error(`dock item already added: ${item.id}`)
    if (!item.command === !item.href) throw new TypeError(`dock item ${item.id} needs exactly one of command or href`)

    const handle = {
      /** @type {HTMLElement | null} */
      element: null,
      update() {
        syncDockItem(handle.element, item)
      },
      remove() {
        remove(item.id)
      },
    }
    handles.set(item.id, handle)
    items.push(item)
    render()
    return handle
  }

  /**
   * @param {string} id
   */
  function remove(id) {
    const index = items.findIndex((item) => item.id === id)
    if (index === -1) return
    items.splice(index, 1)
    handles.delete(id)
    render()
  }

  function render() {
    element.replaceChildren()
    let previousGroup
    let first = true

    for (const item of sorted()) {
      if (!first && item.group != null && previousGroup != null && item.group !== previousGroup)
        element.append(el("span", { class: "docserve-dock__divider", "aria-hidden": "true" }))
      first = false
      previousGroup = item.group

      const node = createDockItem(item, getContext())
      const handle = handles.get(item.id)
      if (handle) handle.element = node
      element.append(node)
    }
  }

  function sorted() {
    return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
}

/**
 * Build one dock item: a command button, or a link when `href` is set.
 * @param {DockItem} item
 * @param {DocserveContext} ctx
 * @returns {HTMLElement}
 */
function createDockItem(item, ctx) {
  const keys = item.command ? ctx.commands.list().find((command) => command.id === item.command)?.keys ?? [] : []
  const props = {
    class: "docserve-dock__button",
    title: keys.length ? `${item.label} (${keys.map(formatKey).join(" / ")})` : item.label,
    "aria-label": item.label,
    "data-action": item.id,
    html: item.icon ?? "",
  }
  const node = item.href
    ? el("a", { ...props, href: item.href })
    : el("button", { ...props, type: "button" })

  syncDockItem(node, item)
  if (!item.href) {
    node.addEventListener("click", () => {
      ctx.commands.run(/** @type {string} */ (item.command)).catch((error) => console.error(`[docserve] dock command failed: ${item.command}`, error))
    })
  }
  return node
}

/**
 * Reflect `isActive` onto `aria-pressed`.
 * @param {HTMLElement | null} node
 * @param {DockItem} item
 */
function syncDockItem(node, item) {
  if (!node || !item.isActive) return
  node.setAttribute("aria-pressed", String(Boolean(item.isActive())))
}