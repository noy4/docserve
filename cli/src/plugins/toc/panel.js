import ICON_CLOSE_RAW from "~icons/lucide/x?raw&width=16&height=16"
import { el, iconSvg } from "../../widget/lib/dom.js"

const ICON_CLOSE = iconSvg(ICON_CLOSE_RAW)
const BLOCKED = new Set([
  "SCRIPT",
  "STYLE",
  "LINK",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "TEMPLATE",
])

/**
 * @typedef {object} TocNodeLike
 * @property {HTMLHeadingElement} element
 * @property {number} level
 * @property {TocNodeLike[]} children
 */

/**
 * @typedef {object} TocPanel
 * @property {HTMLElement} element
 * @property {(nodes: TocNodeLike[]) => void} setTree
 * @property {(id: string | null) => void} setActive
 * @property {(open: boolean) => void} setOpen
 * @property {() => void} layout
 * @property {() => void} destroy
 */

/**
 * @param {object} options
 * @param {() => void} options.onClose
 * @param {(element: HTMLHeadingElement) => void} options.onNavigate
 * @returns {TocPanel}
 */
export function createPanel({ onClose, onNavigate }) {
  const controller = new AbortController()
  const { signal } = controller

  /** @type {Map<string, HTMLElement>} */
  const links = new Map()
  /** @type {string | null} */
  let activeId = null
  /** @type {number} */
  let frame = 0

  const panel = el("aside", {
    class: "docserve-panel docserve-toc",
    "data-side": "right",
    "aria-label": "Table of contents",
  })

  const close = el("button", {
    class: "docserve-toc__close",
    type: "button",
    title: "Close table of contents",
    "aria-label": "Close table of contents",
    html: ICON_CLOSE,
  })
  close.addEventListener("click", () => onClose(), { signal })

  const head = el("header", { class: "docserve-toc__head" }, [
    el("span", { class: "docserve-toc__title", text: "On this page" }),
    close,
  ])

  const marker = el("div", { class: "docserve-toc__marker", "aria-hidden": "true" })
  const listHost = el("div", { class: "docserve-toc__body" })
  const content = el("div", { class: "docserve-toc__content" }, [marker, listHost])
  const scroll = el("nav", { class: "docserve-toc__scroll", "aria-label": "On this page" }, [content])

  panel.append(head, scroll)

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleLayout) : null
  observer?.observe(content)

  return { element: panel, setTree, setActive, setOpen, layout, destroy }

  /**
   * @param {TocNodeLike[]} nodes
   */
  function setTree(nodes) {
    activeId = null
    links.clear()
    marker.style.opacity = "0"
    marker.style.transform = "translateY(0px)"
    scroll.scrollTop = 0
    listHost.replaceChildren()

    if (!nodes.length) {
      listHost.append(el("p", { class: "docserve-toc__empty", text: "No headings on this page" }))
      return
    }

    listHost.append(renderList(nodes))
    scheduleLayout()
  }

  /**
   * @param {string | null} id
   */
  function setActive(id) {
    if (id === activeId) return

    const previous = activeId ? links.get(activeId) : null
    if (previous) {
      previous.classList.remove("is-active")
      previous.removeAttribute("aria-current")
    }

    activeId = id
    const next = id ? links.get(id) : null
    if (next) {
      next.classList.add("is-active")
      next.setAttribute("aria-current", "location")
    }

    layout()
    if (next) reveal(next)
  }

  /**
   * @param {boolean} open
   */
  function setOpen(open) {
    panel.toggleAttribute("data-open", open)
    if (open) scheduleLayout()
  }

  function layout() {
    const active = activeId ? links.get(activeId) : null
    if (!active) {
      marker.style.opacity = "0"
      return
    }

    const top = active.offsetTop + (active.offsetHeight - marker.offsetHeight) / 2
    marker.style.transform = `translateY(${top}px)`
    marker.style.opacity = "1"
  }

  function scheduleLayout() {
    if (frame) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = 0
      layout()
    })
  }

  /**
   * Keep the active row inside the panel without scrolling the page.
   * @param {HTMLElement} anchor
   */
  function reveal(anchor) {
    if (!panel.hasAttribute("data-open")) return

    const top = anchor.offsetTop
    const bottom = top + anchor.offsetHeight
    if (top < scroll.scrollTop + 4)
      scroll.scrollTop = Math.max(0, top - 8)
    else if (bottom > scroll.scrollTop + scroll.clientHeight - 4)
      scroll.scrollTop = bottom - scroll.clientHeight + 8
  }

  /**
   * @param {TocNodeLike[]} nodes
   * @returns {HTMLElement}
   */
  function renderList(nodes) {
    return el(
      "ul",
      { class: "docserve-toc__list" },
      nodes.map((node) =>
        el("li", { class: "docserve-toc__item" }, [
          createLink(node.element),
          ...(node.children.length ? [renderList(node.children)] : []),
        ]),
      ),
    )
  }

  /**
   * @param {HTMLHeadingElement} element
   * @returns {HTMLElement}
   */
  function createLink(element) {
    const anchor = el(
      "a",
      {
        class: "docserve-toc__link",
        href: `#${element.id}`,
        "data-level": String(element.tagName[1]),
      },
      renderHeading(element),
    )

    for (const icon of anchor.querySelectorAll("iconify-icon, svg, img")) {
      icon.removeAttribute("width")
      icon.removeAttribute("height")
    }

    anchor.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
      event.preventDefault()
      onNavigate(element)
    }, { signal })

    links.set(element.id, anchor)
    return anchor
  }

  /**
   * Clone the heading's inline content, keeping icons but dropping ids,
   * handlers and nested interactive elements.
   * @param {HTMLHeadingElement} element
   * @returns {DocumentFragment}
   */
  function renderHeading(element) {
    const fragment = document.createDocumentFragment()
    for (const child of element.childNodes) appendClone(fragment, child)
    return fragment
  }

  /**
   * @param {ParentNode} parent
   * @param {Node} node
   */
  function appendClone(parent, node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.append(node.cloneNode(true))
      return
    }

    if (!(node instanceof Element) || BLOCKED.has(node.tagName)) return

    if (node.tagName === "A") {
      for (const child of node.childNodes) appendClone(parent, child)
      return
    }

    const copy = /** @type {Element} */ (node.cloneNode(false))
    copy.removeAttribute("id")
    copy.removeAttribute("tabindex")
    copy.removeAttribute("contenteditable")
    for (const attribute of [...copy.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on"))
        copy.removeAttribute(attribute.name)
    }

    for (const child of node.childNodes) appendClone(copy, child)
    parent.append(copy)
  }

  function destroy() {
    controller.abort()
    observer?.disconnect()
    if (frame) cancelAnimationFrame(frame)
    links.clear()
    panel.remove()
  }
}
