// Dock toggle plus a left panel that lists every page.
import { decoded, displayDate, el, icon, pageUrl } from "../../widget/lib/dom.js"
import { persistedFlag } from "../../widget/lib/storage.js"

const ICON_SIDEBAR = icon('<rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" />')
const ICON_FOLDER =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.1 10L4 18V8h17a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h15c.9 0 1.7-.6 1.9-1.5l2.3-8.5zM19 18H6l1.6-6h13z"/></svg>'

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
      const name = el("span", {
        class: "docserve-sidebar__name",
        text: ctx.docs?.name || "Pages",
        title: ctx.docs?.name || "Pages",
      })
      const docsPath = el("code", {
        class: "docserve-sidebar__path",
        text: ctx.docs?.path || "",
        title: ctx.docs?.path || "",
      })
      const files = el("span", { class: "docserve-sidebar__files" })
      const closeButton = el("button", {
        type: "button",
        class: "docserve-sidebar__close",
        "aria-label": "Close sidebar",
        title: "Close sidebar",
        html: ICON_SIDEBAR,
        onclick: () => setOpen(false),
      })
      const sub = el("div", { class: "docserve-sidebar__sub" }, [docsPath, files])
      sub.hidden = !ctx.docs
      const list = el("nav", { class: "docserve-sidebar__list", "aria-label": "Pages" })
      const element = el("aside", { class: "docserve-sidebar", "aria-label": ctx.docs?.name || "Pages" }, [
        el("header", { class: "docserve-sidebar__head" }, [
          el("div", { class: "docserve-sidebar__title" }, [
            el("span", { class: "docserve-sidebar__icon", html: ICON_FOLDER }),
            name,
            count,
            closeButton,
          ]),
          sub,
        ]),
        list,
      ])
      if (ctx.docs) element.style.setProperty("--docserve-sidebar-hue", String(ctx.docs.hue))
      list.append(el("p", { class: "docserve-sidebar__empty", text: "Loading…" }))

      ctx.ui.style("/__docserve/plugins/sidebar/sidebar.css")

      const panel = ctx.ui.panel({
        side: "left",
        width: "min(280px, 86vw)",
        open: openState.value,
        element,
      })

      const offToggle = ctx.commands.register({
        id: "plugin:sidebar:toggle",
        title: "Toggle sidebar",
        group: "View",
        icon: ICON_SIDEBAR,
        keys: ["[", "Alt+B"],
        run: () => setOpen(!panel.isOpen()),
      })

      const offClose = ctx.commands.register({
        id: "plugin:sidebar:close",
        title: "Close sidebar",
        keys: ["Escape"],
        showInPalette: false,
        when: () => panel.isOpen(),
        run: () => setOpen(false),
      })

      const item = ctx.dock.add({
        id: "sidebar",
        label: "Toggle sidebar",
        icon: ICON_SIDEBAR,
        group: "main",
        command: "plugin:sidebar:toggle",
        isActive: () => panel.isOpen(),
      })

      const offChange = ctx.on("change", (change) => {
        if (change.pages.length || change.contentSetChanged) load(true)
      })
      const offOpen = ctx.on("open", () => load(true))
      const offStart = ctx.on("start", () => {
        if (panel.isOpen()) scrollActive()
      })

      load()
      scrollActive()

      return () => {
        offToggle()
        offClose()
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
        files.textContent = `${pages.length} ${pages.length === 1 ? "file" : "files"}`
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
        files.textContent = ""
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