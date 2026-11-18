import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { createDisposables } from "../../widget/lib/disposables.js"
import { registerTocCommands, registerTocDock } from "./commands.js"
import { TocModel } from "./model.js"
import { startScrollSpy } from "./scroll-spy.js"
import { TocPanel } from "./ui/TocPanel.js"

/**
 * @returns {DocservePlugin}
 */
export function tocPlugin() {
  return {
    id: "toc",
    setup(ctx) {
      // state
      const html = document.documentElement
      const model = TocModel.create()
      const cleanup = createDisposables()

      // styles
      ctx.ui.style("/__docserve/plugins/toc/toc.css")

      // panel
      const mount = ctx.ui.mountPoint()
      const root = createRoot(mount)
      root.render(createElement(TocPanel, { model }))
      cleanup.add(() => {
        root.unmount()
        mount.remove()
      })
      cleanup.add(model.subscribe())

      // open state
      cleanup.add(model.open.subscribe(() => {
        html.toggleAttribute("data-docserve-panel-right", model.open.value)
      }))

      // commands
      cleanup.add(registerTocCommands(ctx, model))
      cleanup.add(registerTocDock(ctx, model))

      // scroll spy
      cleanup.add(startScrollSpy(model))

      // teardown
      cleanup.add(() => html.removeAttribute("data-docserve-panel-right"))

      // data
      model.load()

      return cleanup.dispose
    },
  }
}
