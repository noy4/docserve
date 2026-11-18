// Dock toggle plus a left panel that lists every page, as rows or preview cards.
import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { createDisposables } from "../../widget/lib/disposables.js"
import { ICON_CALENDAR, ICON_GRID, ICON_SIDEBAR } from "./icons.js"
import { SidebarModel } from "./model.js"
import { Sidebar } from "./ui/Sidebar.js"

/**
 * @returns {DocservePlugin}
 */
export function sidebarPlugin() {
  return {
    id: "sidebar",
    setup(ctx) {
      // state
      const model = SidebarModel.fromContext(ctx)
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
      root.render(createElement(Sidebar, { model }))

      // commands
      registerCommands(ctx, model, cleanup)

      // dock
      const dock = ctx.docks.register({
        id: "sidebar",
        title: "Toggle sidebar",
        icon: ICON_SIDEBAR,
        category: "main",
        command: "plugin:sidebar:toggle",
        isActive: () => model.open.value,
      })
      cleanup.add(() => dock.dispose())
      cleanup.add(model.open.subscribe(() => dock.update()))

      // events
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

/**
 * Register every sidebar command; each one is unregistered by `cleanup`.
 * @param {DocserveContext} ctx
 * @param {SidebarModel} model
 * @param {import("../../widget/lib/disposables.js").Disposables} cleanup
 */
function registerCommands(ctx, model, cleanup) {
  cleanup.add(ctx.commands.register({
    id: "plugin:sidebar:toggle",
    title: "Toggle sidebar",
    category: "View",
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
    category: "View",
    icon: ICON_GRID,
    keys: ["v"],
    when: () => model.open.value,
    run: () => model.toggleView(),
  }))

  cleanup.add(ctx.commands.register({
    id: "plugin:sidebar:grouping",
    title: "Toggle month grouping",
    category: "View",
    icon: ICON_CALENDAR,
    keys: ["m"],
    when: () => model.open.value,
    run: () => model.toggleGrouping(),
  }))
}
