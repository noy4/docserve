import ICON_FOLD_RAW from "~icons/lucide/fold-vertical?raw&width=18&height=18"
import ICON_UNFOLD_RAW from "~icons/lucide/unfold-vertical?raw&width=18&height=18"
import { iconSvg } from "../../widget/lib/dom.js"
import type { CollapseModel } from "./model.js"

const ICON_FOLD = iconSvg(ICON_FOLD_RAW)
const ICON_UNFOLD = iconSvg(ICON_UNFOLD_RAW)

export function registerCollapseCommands(ctx: DocserveContext, model: CollapseModel): () => void {
  const offEnabled = ctx.commands.register({
    id: "plugin:collapse:toggle-enabled",
    title: "Enable/disable collapse",
    category: "View",
    icon: ICON_FOLD,
    keys: ["Alt+K"],
    run: () => model.toggleEnabled(),
  })

  const offToggle = ctx.commands.register({
    id: "plugin:collapse:toggle-all",
    title: "Toggle all sections",
    category: "View",
    icon: ICON_FOLD,
    keys: ["k"],
    when: () => model.enabled.value,
    run: () => model.toggleAll(),
  })

  const offExpand = ctx.commands.register({
    id: "plugin:collapse:expand-all",
    title: "Expand all sections",
    category: "View",
    icon: ICON_UNFOLD,
    when: () => model.enabled.value,
    run: () => model.expandAll(),
  })

  const offCollapse = ctx.commands.register({
    id: "plugin:collapse:collapse-all",
    title: "Collapse all sections",
    category: "View",
    icon: ICON_FOLD,
    when: () => model.enabled.value,
    run: () => model.collapseAll(),
  })

  return () => {
    offCollapse()
    offExpand()
    offToggle()
    offEnabled()
  }
}

export function registerCollapseDock(ctx: DocserveContext, model: CollapseModel): () => void {
  /** @type {DocksItemHandle | null} */
  let dock = null

  const offEnabled = model.enabled.subscribe(sync)

  return () => {
    offEnabled()
    dock?.dispose()
    dock = null
  }

  function sync(): void {
    if (model.enabled.value && !dock) {
      dock = ctx.docks.register({
        id: "collapse",
        title: "Toggle all sections",
        icon: ICON_FOLD,
        category: "actions",
        command: "plugin:collapse:toggle-all",
      })
    } else if (!model.enabled.value && dock) {
      dock.dispose()
      dock = null
    }
  }
}
