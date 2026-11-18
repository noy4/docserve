import { createDisposables } from "../../widget/lib/disposables.js"
import { registerTocCommands, registerTocDock } from "./commands.js"
import { TocModel } from "./model.js"
import { createPanel } from "./panel.js"
import { startScrollSpy } from "./scroll-spy.js"

const OFFSET = 88

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
      const panel = createPanel({
        onClose: () => model.setOpen(false),
        onNavigate: navigate,
      })
      const mount = ctx.ui.mountPoint()
      mount.append(panel.element)

      // state bindings
      cleanup.add(model.tree.subscribe((tree) => panel.setTree(tree)))
      cleanup.add(model.activeId.subscribe((id) => panel.setActive(id)))
      cleanup.add(model.open.subscribe(() => {
        const open = model.open.value
        html.toggleAttribute("data-docserve-panel-right", open)
        panel.setOpen(open)
      }))

      // commands
      cleanup.add(registerTocCommands(ctx, model))
      cleanup.add(registerTocDock(ctx, model))

      // scroll spy
      cleanup.add(startScrollSpy(model, OFFSET))

      // teardown
      cleanup.add(() => html.removeAttribute("data-docserve-panel-right"))
      cleanup.add(() => panel.destroy())
      cleanup.add(() => mount.remove())

      // data
      model.load()

      return cleanup.dispose

      // navigation
      function navigate(element) {
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
        const top = window.scrollY + element.getBoundingClientRect().top - OFFSET

        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" })
        history.replaceState(null, "", `#${element.id}`)
        model.setActive(element.id)
      }
    },
  }
}
