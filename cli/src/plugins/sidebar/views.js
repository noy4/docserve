// Page rendering for the sidebar: one row per page, or one preview card.
import { decoded, displayDate, el, pageUrl } from "../../widget/lib/dom.js"

/**
 * @param {HTMLElement} root
 * @param {object} options
 * @param {DocPage[]} options.pages
 * @param {"list" | "gallery"} options.view
 * @param {string} options.currentPage  Docs-relative path of the page being viewed.
 * @param {(thumb: HTMLElement) => void} [options.onThumb]
 * @returns {HTMLElement | null} The entry for the page being viewed.
 */
export function renderPages(root, { pages, view, currentPage, onThumb }) {
  const target = pageUrl(currentPage)
  /** @type {HTMLElement | null} */
  let active = null

  const nodes = pages.map((page) => {
    const node = view === "gallery"
      ? galleryCard(page, target, currentPage, onThumb)
      : listRow(page, target, currentPage)
    if (isActive(page, target, currentPage)) active = node
    return node
  })

  root.replaceChildren(...nodes)
  return active
}

/**
 * @param {DocPage} page
 * @param {string} target
 * @param {string} currentPage
 */
function listRow(page, target, currentPage) {
  return el("a", {
    class: "docserve-sidebar__item",
    href: page.url,
    title: page.title,
    "aria-current": isActive(page, target, currentPage) ? "page" : null,
  }, [
    el("span", { class: "docserve-sidebar__title" }, [
      favicon(page),
      el("span", { text: pageLabel(page) }),
    ]),
    el("span", { class: "docserve-sidebar__date", text: displayDate(page.created) }),
  ])
}

/**
 * @param {DocPage} page
 * @param {string} target
 * @param {string} currentPage
 * @param {((thumb: HTMLElement) => void) | undefined} onThumb
 */
function galleryCard(page, target, currentPage, onThumb) {
  const thumb = el("div", { class: "docserve-sidebar__thumb" }, [
    el("iframe", { tabindex: -1, title: pageLabel(page), "data-src": page.url }),
  ])
  onThumb?.(thumb)

  return el("a", {
    class: "docserve-sidebar__card",
    href: page.url,
    title: page.title,
    "aria-current": isActive(page, target, currentPage) ? "page" : null,
  }, [
    thumb,
    el("div", { class: "docserve-sidebar__meta" }, [
      el("div", { class: "docserve-sidebar__card-title" }, [
        favicon(page),
        el("span", { text: pageLabel(page) }),
      ]),
      el("div", { class: "docserve-sidebar__card-date", text: displayDate(page.created) }),
    ]),
  ])
}

/**
 * @param {DocPage} page
 * @returns {HTMLElement | null}
 */
function favicon(page) {
  if (!page.favicon) return null
  return el("img", {
    class: "docserve-sidebar__favicon",
    src: page.favicon,
    alt: "",
    loading: "lazy",
    onerror: (e) => e.currentTarget.remove(),
  })
}

/**
 * @param {DocPage} page
 * @param {string} target
 * @param {string} currentPage
 * @returns {boolean}
 */
function isActive(page, target, currentPage) {
  return page.url === target || decoded(page.url) === `/${currentPage}`
}

/**
 * @param {DocPage} page
 * @returns {string}
 */
function pageLabel(page) {
  return page.title || decoded(page.url)
}
