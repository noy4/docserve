import ICON_FOLD_RAW from "~icons/lucide/fold-vertical?raw&width=18&height=18"
import ICON_UNFOLD_RAW from "~icons/lucide/unfold-vertical?raw&width=18&height=18"
import { iconSvg } from "../../widget/lib/dom.js"
import type { CollapseModel } from "./model.js"

const ICON_FOLD = iconSvg(ICON_FOLD_RAW)
const ICON_UNFOLD = iconSvg(ICON_UNFOLD_RAW)

export function registerCollapseCommands(ctx: DocserveContext, model: CollapseModel): () => void {
  const offToggle = ctx.commands.register({
    id: "plugin:collapse:toggle-all",
    title: "Toggle all sections",
    category: "View",
    icon: ICON_FOLD,
    keys: ["k"],
    run: () => model.toggleAll(),
  })

  const offExpand = ctx.commands.register({
    id: "plugin:collapse:expand-all",
    title: "Expand all sections",
    category: "View",
    icon: ICON_UNFOLD,
    run: () => model.expandAll(),
  })

  const offCollapse = ctx.commands.register({
    id: "plugin:collapse:collapse-all",
    title: "Collapse all sections",
    category: "View",
    icon: ICON_FOLD,
    run: () => model.collapseAll(),
  })

  return () => {
    offCollapse()
    offExpand()
    offToggle()
  }
}

export function registerCollapseDock(ctx: DocserveContext, model: CollapseModel): () => void {
  const dock = ctx.docks.register({
    id: "collapse",
    title: "Toggle all sections",
    icon: ICON_FOLD,
    category: "actions",
    command: "plugin:collapse:toggle-all",
  })

  const offCollapsed = model.collapsed.subscribe(() => dock.update())

  return () => {
    offCollapsed()
    dock.dispose()
  }
}
