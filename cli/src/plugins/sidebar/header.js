// Sidebar header: home link, folder identity, file count, view tabs and close.
import { el } from "../../widget/lib/dom.js"
import { ICON_FOLDER, ICON_GRID, ICON_LIST, ICON_SIDEBAR } from "./icons.js"

/**
 * @param {object} options
 * @param {DocsInfo | undefined} options.docs
 * @param {"list" | "gallery"} options.view
 * @param {() => void} options.onClose
 * @param {(view: "list" | "gallery") => void} options.onView
 */
export function createHeader({ docs, view, onClose, onView }) {
  const name = el("span", {
    class: "docserve-sidebar__name",
    text: docs?.name || "Pages",
    title: docs?.name || "Pages",
  })
  const docsPath = el("code", {
    class: "docserve-sidebar__path",
    text: docs?.path || "",
    title: docs?.path || "",
  })
  docsPath.hidden = !docs

  const files = el("span", { class: "docserve-sidebar__files" })
  const listButton = el("button", {
    type: "button",
    class: "docserve-sidebar__view",
    "aria-label": "List view",
    title: "List view",
    html: ICON_LIST,
    onclick: () => onView("list"),
  })
  const galleryButton = el("button", {
    type: "button",
    class: "docserve-sidebar__view",
    "aria-label": "Gallery view",
    title: "Gallery view",
    html: ICON_GRID,
    onclick: () => onView("gallery"),
  })
  const viewTabs = el("div", { class: "docserve-sidebar__views", role: "group", "aria-label": "View" }, [
    listButton,
    galleryButton,
  ])
  const homeLink = el("a", { class: "docserve-sidebar__home", href: "/", title: "Open gallery" }, [
    el("span", { class: "docserve-sidebar__icon", html: ICON_FOLDER }),
    name,
  ])
  const closeButton = el("button", {
    type: "button",
    class: "docserve-sidebar__close",
    "aria-label": "Close sidebar",
    title: "Close sidebar",
    html: ICON_SIDEBAR,
    onclick: onClose,
  })

  const element = el("header", { class: "docserve-sidebar__head" }, [
    el("div", { class: "docserve-sidebar__title" }, [homeLink, closeButton]),
    el("div", { class: "docserve-sidebar__sub" }, [docsPath, files, viewTabs]),
  ])

  syncView(view)

  return {
    element,
    /** @param {"list" | "gallery"} next */
    setView(next) {
      syncView(next)
    },
    /** @param {number | null} count  null clears the label. */
    setFiles(count) {
      files.textContent = count == null ? "" : `${count} ${count === 1 ? "file" : "files"}`
    },
    /** @param {boolean} visible */
    setTabsVisible(visible) {
      viewTabs.style.display = visible ? "" : "none"
    },
  }

  /**
   * @param {"list" | "gallery"} next
   */
  function syncView(next) {
    listButton.setAttribute("aria-pressed", String(next === "list"))
    galleryButton.setAttribute("aria-pressed", String(next === "gallery"))
  }
}
