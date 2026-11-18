import { createDisposables } from "../../widget/lib/disposables.js"
import { el } from "../../widget/lib/dom.js"
import { registerCollapseCommands, registerCollapseDock } from "./commands.js"
import { CollapseModel } from "./model.js"
import { collectSections } from "./sections.js"

/**
 * @returns {DocservePlugin}
 */
export function collapsePlugin() {
  return {
    id: "collapse",
    setup(ctx) {
      // sections
      const collect = collectSections(document)

      // state
      const model = CollapseModel.create(ctx.page)
      const cleanup = createDisposables()

      // styles
      const link = el("link", {
        rel: "stylesheet",
        href: "/__docserve/plugins/collapse/collapse.css",
        "data-docserve-collapse": "",
      })
      document.head.append(link)
      cleanup.add(() => link.remove())

      // sections
      model.load(collect)
      cleanup.add(model.subscribe())

      // commands
      cleanup.add(registerCollapseCommands(ctx, model))
      cleanup.add(registerCollapseDock(ctx, model))

      // rpc
      cleanup.add(ctx.rpc.register("plugin:collapse:is-collapsed", (id) => model.isCollapsed(id)))
      cleanup.add(ctx.rpc.register("plugin:collapse:expand-ancestors", (id) => model.expandAncestors(id)))

      return cleanup.dispose
    },
  }
}
