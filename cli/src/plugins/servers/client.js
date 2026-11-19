import { createElement } from "react"
import { createRoot } from "react-dom/client"
import ICON_SERVERS_RAW from "~icons/lucide/server?raw&width=18&height=18"
import { createDisposables } from "../../widget/lib/disposables.js"
import { iconSvg } from "../../widget/lib/dom.js"
import { registerServersCommands } from "./commands.js"
import { ServersModel } from "./model.js"
import { ServersPopover } from "./ui/ServersPopover.js"

const ICON_SERVERS = iconSvg(ICON_SERVERS_RAW)

/**
 * @returns {DocservePlugin}
 */
export function serversPlugin() {
  return {
    id: "servers",
    setup(ctx) {
      // state
      const model = ServersModel.fromContext(ctx)
      const cleanup = createDisposables()

      // styles
      ctx.ui.style("/__docserve/plugins/servers/servers.css")

      // mount
      const mount = ctx.ui.mountPoint()
      const root = createRoot(mount)
      cleanup.add(() => {
        root.unmount()
        mount.remove()
      })
      root.render(createElement(ServersPopover, { model }))

      // commands
      cleanup.add(registerServersCommands(ctx, model))

      // dock
      const dock = ctx.docks.register({
        id: "servers",
        title: "Toggle running servers",
        icon: ICON_SERVERS,
        category: "main",
        order: 2,
        command: "plugin:servers:toggle",
        isActive: () => model.open.value,
      })
      cleanup.add(() => dock.dispose())
      cleanup.add(model.open.subscribe(() => {
        if (model.open.value) model.setAnchor(dock.element)
        dock.update()
      }))
      model.setAnchor(dock.element)

      // outside click
      const onPointerDown = (event) => {
        if (!model.open.value) return
        const path = event.composedPath()
        if (path.includes(dock.element)) return
        if (path.some((node) => node instanceof Element && node.classList.contains("docserve-servers"))) return
        model.close()
      }
      document.addEventListener("pointerdown", onPointerDown, true)
      cleanup.add(() => document.removeEventListener("pointerdown", onPointerDown, true))

      // events
      cleanup.add(ctx.events.on("live:connected", () => {
        model.load({ force: true })
      }))

      // teardown
      cleanup.add(() => model.dispose())

      return cleanup.dispose
    },
  }
}
