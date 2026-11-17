// Dock toggle plus a left panel that lists every page, as rows or preview cards.
import { el } from "../../widget/lib/dom.js"
import { persisted, persistedFlag } from "../../widget/lib/storage.js"
import { createHeader } from "./header.js"
import { ICON_GRID, ICON_SIDEBAR } from "./icons.js"
import { createPreviews } from "./previews.js"
import { renderPages } from "./views.js"

/**
 * @returns {DocservePlugin}
 */
export function sidebarPlugin() {
  return {
    id: "sidebar",
    setup(ctx) {
      const openState = persistedFlag("docserve:sidebar:open")
      const viewState = persisted("docserve:sidebar:view", /** @type {"list" | "gallery"} */ ("list"))
      /** @type {"list" | "gallery"} */
      let view = viewState.value
      /** @type {DocPage[]} */
      let pages = []
      /** @type {HTMLElement | null} */
      let activeItem = null
      let request = 0

      const header = createHeader({
        docs: ctx.docs,
        view,
        onClose: () => setOpen(false),
        onView: setView,
      })
      const list = el("nav", { class: "docserve-sidebar__list", "aria-label": "Pages" })
      const element = el("aside", { class: "docserve-sidebar", "aria-label": ctx.docs?.name || "Pages" }, [
        header.element,
        list,
      ])
      element.dataset.view = view
      if (ctx.docs) element.style.setProperty("--docserve-sidebar-hue", String(ctx.docs.hue))
      list.append(el("p", { class: "docserve-sidebar__empty", text: "Loading…" }))

      ctx.ui.style("/__docserve/plugins/sidebar/sidebar.css")

      const panel = ctx.ui.panel({
        side: "left",
        width: "min(280px, 86vw)",
        open: openState.value,
        element,
      })

      const previews = createPreviews(list)
      const resize = new ResizeObserver(() => previews.fit())
      resize.observe(list)

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

      const offView = ctx.commands.register({
        id: "plugin:sidebar:view",
        title: "Toggle sidebar view",
        group: "View",
        icon: ICON_GRID,
        keys: ["v"],
        when: () => panel.isOpen(),
        run: () => setView(view === "list" ? "gallery" : "list"),
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
        offView()
        offChange()
        offOpen()
        offStart()
        item.remove()
        panel.remove()
        resize.disconnect()
        previews.reset()
      }

      /**
       * @param {boolean} next
       */
      function setOpen(next) {
        panel.setOpen(next)
        item.update()
        openState.value = next
        if (!next) return
        if (view === "gallery") previews.fit()
        scrollActive()
      }

      /**
       * @param {"list" | "gallery"} next
       */
      function setView(next) {
        view = next === "gallery" ? "gallery" : "list"
        viewState.value = view
        element.dataset.view = view
        header.setView(view)
        render()
      }


      /**
       * @param {boolean} [force]
       */
      async function load(force = false) {
        const id = ++request
        try {
          pages = /** @type {DocPage[]} */ (await ctx.rpc.call("docserve:pages:list", { force }))
          if (id === request) render()
        } catch {
          if (id === request) renderError()
        }
      }

      function render() {
        header.setFiles(pages.length)
        header.setTabsVisible(pages.length > 0)
        const scrollTop = list.scrollTop
        previews.reset()
        activeItem = null

        if (!pages.length) {
          list.replaceChildren(el("p", { class: "docserve-sidebar__empty", text: "No pages" }))
          return
        }

        activeItem = renderPages(list, {
          pages,
          view,
          currentPage: ctx.page,
          onThumb: (thumb) => previews.watch(thumb),
        })

        list.scrollTop = scrollTop
        if (view === "gallery") previews.fit()
        if (panel.isOpen()) scrollActive()
      }

      function renderError() {
        header.setFiles(null)
        header.setTabsVisible(false)
        activeItem = null
        previews.reset()
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
