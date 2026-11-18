import ICON_TOC_RAW from "~icons/lucide/list-tree?raw&width=18&height=18"
import { iconSvg } from "../../widget/lib/dom.js"
import type { TocModel } from "./model.js"

const ICON_TOC = iconSvg(ICON_TOC_RAW)

export function registerTocCommands(ctx: DocserveContext, model: TocModel): () => void {
  const offToggle = ctx.commands.register({
    id: "plugin:toc:toggle",
    title: "Toggle table of contents",
    category: "View",
    icon: ICON_TOC,
    keys: ["t"],
    run: () => model.toggle(),
  })

  const offClose = ctx.commands.register({
    id: "plugin:toc:close",
    title: "Close table of contents",
    keys: ["Escape"],
    showInPalette: false,
    when: () => model.open.value,
    run: () => model.setOpen(false),
  })

  return () => {
    offClose()
    offToggle()
  }
}

export function registerTocDock(ctx: DocserveContext, model: TocModel): () => void {
  const dock = ctx.docks.register({
    id: "toc",
    title: "Toggle table of contents",
    icon: ICON_TOC,
    category: "main",
    order: 1,
    command: "plugin:toc:toggle",
    isActive: () => model.open.value,
  })

  const offOpen = model.open.subscribe(() => dock.update())

  return () => {
    offOpen()
    dock.dispose()
  }
}
