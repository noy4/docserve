// Dock toggle plus a left panel that lists every page, as rows or preview cards.
import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { createDisposables } from "../../widget/lib/disposables.js"
import { persisted, persistedFlag } from "../../widget/lib/storage.js"
import { ICON_GRID, ICON_SIDEBAR } from "./icons.js"
import { SidebarModel } from "./model.js"
import { SidebarApp } from "./ui/SidebarApp.js"

const WIDTH = "min(280px, 86vw)"

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

      const model = new SidebarModel({
        rpc: ctx.rpc,
        view: viewState.value === "gallery" ? "gallery" : "list",
        grouping: groupingState.value === "none" ? "none" : "month",
        open: openState.value,
        onViewChange(next) {
          viewState.value = next
        },
        onGroupingChange(next) {
          groupingState.value = next
        },
      })

      ctx.ui.style("/__docserve/plugins/sidebar/sidebar.css")

      const disposables = createDisposables()

      const host = ctx.ui.mountPoint()
      const root = createRoot(host)
      disposables.add(() => {
        root.unmount()
        host.remove()
      })
      root.render(createElement(SidebarApp, {
        model,
        docs: ctx.docs,
        currentPage: ctx.page,
        width: WIDTH,
        onClose: () => setOpen(false),
      }))

      disposables.add(ctx.commands.register({
        id: "plugin:sidebar:toggle",
        title: "Toggle sidebar",
        group: "View",
        icon: ICON_SIDEBAR,
        keys: ["[", "Alt+B"],
        run: () => setOpen(!model.open.value),
      }))

      disposables.add(ctx.commands.register({
        id: "plugin:sidebar:close",
        title: "Close sidebar",
        keys: ["Escape"],
        showInPalette: false,
        when: () => model.open.value,
        run: () => setOpen(false),
      }))

      disposables.add(ctx.commands.register({
        id: "plugin:sidebar:view",
        title: "Toggle sidebar view",
        group: "View",
        icon: ICON_GRID,
        keys: ["v"],
        when: () => model.open.value,
        run: () => model.toggleView(),
      }))

      disposables.add(ctx.commands.register({
        id: "plugin:sidebar:grouping",
        title: "Toggle month grouping",
        group: "View",
        keys: ["m"],
        when: () => model.open.value,
        run: () => model.toggleGrouping(),
      }))

      const item = ctx.dock.add({
        id: "sidebar",
        label: "Toggle sidebar",
        icon: ICON_SIDEBAR,
        group: "main",
        command: "plugin:sidebar:toggle",
        isActive: () => model.open.value,
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
        model.setOpen(next)
        openState.value = next
        item.update()
      }
    },
  }
}
