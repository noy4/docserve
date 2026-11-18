// Dock toggle plus a left panel that lists every page, as rows or preview cards.
import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { createDisposables } from "../../widget/lib/disposables.js"
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
      // state
      const model = new SidebarModel({ rpc: ctx.rpc })

      // styles
      ctx.ui.style("/__docserve/plugins/sidebar/sidebar.css")

      // cleanup
      const cleanup = createDisposables()

      // mount
      const host = ctx.ui.mountPoint()
      const root = createRoot(host)
      cleanup.add(() => {
        root.unmount()
        host.remove()
      })
      root.render(createElement(SidebarApp, {
        model,
        docs: ctx.docs,
        currentPage: ctx.page,
        width: WIDTH,
        onClose: () => model.setOpen(false),
      }))

      // commands
      cleanup.add(ctx.commands.register({
        id: "plugin:sidebar:toggle",
        title: "Toggle sidebar",
        group: "View",
        icon: ICON_SIDEBAR,
        keys: ["[", "Alt+B"],
        run: () => model.setOpen(!model.open.value),
      }))

      cleanup.add(ctx.commands.register({
        id: "plugin:sidebar:close",
        title: "Close sidebar",
        keys: ["Escape"],
        showInPalette: false,
        when: () => model.open.value,
        run: () => model.setOpen(false),
      }))

      cleanup.add(ctx.commands.register({
        id: "plugin:sidebar:view",
        title: "Toggle sidebar view",
        group: "View",
        icon: ICON_GRID,
        keys: ["v"],
        when: () => model.open.value,
        run: () => model.toggleView(),
      }))

      cleanup.add(ctx.commands.register({
        id: "plugin:sidebar:grouping",
        title: "Toggle month grouping",
        group: "View",
        keys: ["m"],
        when: () => model.open.value,
        run: () => model.toggleGrouping(),
      }))

      // dock
      const dock = ctx.docks.register({
        id: "sidebar",
        label: "Toggle sidebar",
        icon: ICON_SIDEBAR,
        group: "main",
        command: "plugin:sidebar:toggle",
        isActive: () => model.open.value,
      })
      cleanup.add(() => dock.dispose())
      cleanup.add(model.open.subscribe(() => dock.update()))

      // data
      cleanup.add(ctx.events.on("pages:changed", (change) => {
        if (change.pages.length || change.contentSetChanged)
          model.load({ force: true })
      }))
      cleanup.add(ctx.events.on("live:connected", () => model.load({ force: true })))

      model.load()

      return cleanup.dispose
    },
  }
}
