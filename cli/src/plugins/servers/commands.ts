import ICON_SERVERS_RAW from "~icons/lucide/server?raw&width=18&height=18"
import { iconSvg } from "../../widget/lib/dom.js"
import type { ServersModel } from "./model.js"

const ICON_SERVERS = iconSvg(ICON_SERVERS_RAW)

export function registerServersCommands(ctx: DocserveContext, model: ServersModel): () => void {
  const offToggle = ctx.commands.register({
    id: "plugin:servers:toggle",
    title: "Toggle running servers",
    category: "View",
    icon: ICON_SERVERS,
    keys: ["s"],
    run: () => model.toggle(),
  })

  const offClose = ctx.commands.register({
    id: "plugin:servers:close",
    title: "Close running servers",
    keys: ["Escape"],
    showInPalette: false,
    when: () => model.open.value,
    run: () => model.close(),
  })

  return () => {
    offClose()
    offToggle()
  }
}
