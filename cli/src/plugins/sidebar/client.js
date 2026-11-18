// Dock toggle plus a left panel that lists every page, as rows or preview cards.
import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { el } from "../../widget/lib/dom.js"
import { createDisposables } from "../../widget/lib/disposables.js"
import { persisted, persistedFlag } from "../../widget/lib/storage.js"
import { ICON_GRID, ICON_SIDEBAR } from "./icons.js"
import { SidebarModel } from "./model.js"
import { SidebarApp } from "./ui/SidebarApp.js"

/**
 * @returns {DocservePlugin}
 */
export function sidebarPlugin() {
  return {
    id: "sidebar",
    setup(ctx) {
      const openState = persistedFlag("docserve:sidebar:open")
      const viewState = persisted("docserve:sidebar:view", /** @type {"list" | "gallery"} */("list"))
      const groupingState = persisted("docserve:sidebar:grouping", /** @type {"none" | "month"} */("month"))

      const element = el("aside", { class: "docserve-sidebar", "aria-label": ctx.docs?.name || "Pages" })
      if (ctx.docs) element.style.setProperty("--docserve-sidebar-hue", String(ctx.docs.hue))

      const model = new SidebarModel({
        rpc: ctx.rpc,
        view: viewState.value === "gallery" ? "gallery" : "list",
        grouping: groupingState.value === "none" ? "none" : "month",
        open: openState.value,
        onViewChange(next) {
          viewState.value = next
          element.dataset.view = next
        },
        onGroupingChange(next) {
          groupingState.value = next
          element.dataset.grouping = next
        },
      })
      element.dataset.view = model.view.value
      element.dataset.grouping = model.grouping.value

      ctx.ui.style("/__docserve/plugins/sidebar/sidebar.css")

      const disposables = createDisposables()

      const panel = ctx.ui.panel({
        side: "left",
        width: "min(280px, 86vw)",
        open: openState.value,
        element,
      })
      disposables.add(() => panel.remove())

      const root = createRoot(element)
      disposables.add(() => root.unmount())
      root.render(createElement(SidebarApp, {
        model,
        docs: ctx.docs,
        currentPage: ctx.page,
        onClose: () => setOpen(false),
      }))

      disposables.add(ctx.commands.register({
        id: "plugin:sidebar:toggle",
        title: "Toggle sidebar",
        group: "View",
        icon: ICON_SIDEBAR,
        keys: ["[", "Alt+B"],
        run: () => setOpen(!panel.isOpen()),
      }))

      disposables.add(ctx.commands.register({
        id: "plugin:sidebar:close",
        title: "Close sidebar",
        keys: ["Escape"],
        showInPalette: false,
        when: () => panel.isOpen(),
        run: () => setOpen(false),
      }))

      disposables.add(ctx.commands.register({
        id: "plugin:sidebar:view",
        title: "Toggle sidebar view",
        group: "View",
        icon: ICON_GRID,
        keys: ["v"],
        when: () => panel.isOpen(),
        run: () => model.toggleView(),
      }))

      disposables.add(ctx.commands.register({
        id: "plugin:sidebar:grouping",
        title: "Toggle month grouping",
        group: "View",
        keys: ["m"],
        when: () => panel.isOpen(),
        run: () => model.toggleGrouping(),
      }))

      const item = ctx.dock.add({
        id: "sidebar",
        label: "Toggle sidebar",
        icon: ICON_SIDEBAR,
        group: "main",
        command: "plugin:sidebar:toggle",
        isActive: () => panel.isOpen(),
      })
      disposables.add(() => item.remove())

      disposables.add(ctx.on("change", (change) => {
        if (change.pages.length || change.contentSetChanged)
          model.load({ force: true })
      }))
      disposables.add(ctx.on("open", () => model.load({ force: true })))

      model.load()

      return disposables.dispose

      /**
       * @param {boolean} next
       */
      function setOpen(next) {
        panel.setOpen(next)
        item.update()
        openState.value = next
        model.open.value = next
      }
    },
  }
}
