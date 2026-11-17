// Dock toggle plus a left panel that lists every page.
import { decoded, displayDate, el, icon, isTyping, pageUrl } from "../../widget/lib/dom.js"
import { persistedFlag } from "../../widget/lib/storage.js"

const ICON_SIDEBAR = icon('<rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" />')

/**
 * @returns {DocservePlugin}
 */
export function sidebarPlugin() {
  return {
    id: "sidebar",
    setup(ctx) {
      const openState = persistedFlag("docserve:sidebar:open")
      /** @type {HTMLElement | null} */
      let activeItem = null
      let request = 0

      const count = el("span", { class: "docserve-sidebar__count" })
      const list = el("nav", { class: "docserve-sidebar__list", "aria-label": "Pages" })
      const element = el("aside", { class: "docserve-sidebar", "aria-label": "Pages" }, [
        el("div", { class: "docserve-sidebar__head" }, [
          el("span", { text: "Pages" }),
          count,
        ]),
        list,
      ])
      list.append(el("p", { class: "docserve-sidebar__empty", text: "Loading…" }))

      ctx.ui.style("/__docserve/plugins/sidebar/sidebar.css")

      const panel = ctx.ui.panel({
        side: "left",
        width: "min(280px, 86vw)",
        open: openState.value,
        element,
      })

      const item = ctx.dock.add({
        id: "sidebar",
        label: "Toggle sidebar",
        icon: ICON_SIDEBAR,
        group: "main",
        isActive: () => panel.isOpen(),
        onClick: () => setOpen(!panel.isOpen()),
      })

      const offChange = ctx.on("change", (change) => {
        if (change.pages.length || change.contentSetChanged) load(true)
      })
      const offOpen = ctx.on("open", () => load(true))
      const offStart = ctx.on("start", () => {
        if (panel.isOpen()) scrollActive()
      })

      window.addEventListener("keydown", onKeydown)

      load()
      scrollActive()

      return () => {
        window.removeEventListener("keydown", onKeydown)
        offChange()
        offOpen()
        offStart()
        item.remove()
        panel.remove()
      }

      /**
       * @param {boolean} next
       */
      function setOpen(next) {
        panel.setOpen(next)
        item.update()
        openState.value = next
        if (next) scrollActive()
      }

      /**
       * @param {KeyboardEvent} event
       */
      function onKeydown(event) {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
        if (isTyping(event.target)) return

        if (event.key === "[") {
          event.preventDefault()
          setOpen(!panel.isOpen())
        } else if (event.key === "Escape" && panel.isOpen()) {
          setOpen(false)
        }
      }

      /**
       * @param {boolean} [force]
       */
      async function load(force = false) {
        const id = ++request
        try {
          const pages = /** @type {DocPage[]} */ (await ctx.rpc.call("docserve:pages:list", { force }))
          if (id === request) render(pages)
        } catch {
          if (id === request) renderError()
        }
      }

      /**
       * @param {DocPage[]} pages
       */
      function render(pages) {
        count.textContent = String(pages.length)
        const scrollTop = list.scrollTop
        list.replaceChildren()
        activeItem = null

        if (!pages.length) {
          list.append(el("p", { class: "docserve-sidebar__empty", text: "No pages" }))
          return
        }

        const target = pageUrl(ctx.page)
        for (const page of pages) {
          const active = page.url === target || decoded(page.url) === `/${ctx.page}`
          const link = el("a", {
            class: "docserve-sidebar__item",
            href: page.url,
            title: page.title,
            "aria-current": active ? "page" : null,
          }, [
            el("span", { class: "docserve-sidebar__title", text: page.title || decoded(page.url) }),
            el("span", { class: "docserve-sidebar__date", text: displayDate(page.created) }),
          ])
          if (active) activeItem = link
          list.append(link)
        }

        list.scrollTop = scrollTop
        if (panel.isOpen()) scrollActive()
      }

      function renderError() {
        count.textContent = ""
        activeItem = null
        list.replaceChildren(el("div", { class: "docserve-sidebar__empty" }, [
          el("p", { text: "Could not load pages" }),
          el("button", { type: "button", class: "docserve-sidebar__retry", text: "Retry", onclick: () => load(true) }),
        ]))
      }

      function scrollActive() {
        activeItem?.scrollIntoView({ block: "nearest" })
      }
    },
  }
}