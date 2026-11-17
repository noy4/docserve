// Widget entry: register the built-in plugins, then start.
import { copyPlugin } from "../plugins/copy/client.js"
import { homePlugin } from "../plugins/home/client.js"
import { sidebarPlugin } from "../plugins/sidebar/client.js"
import { createHost } from "./host.js"

const PLUGINS = [sidebarPlugin, homePlugin, copyPlugin]

// The server skips iframe previews; this guard covers pages served some other way.
if (window.self === window.top && !document.getElementById("docserve-dock-host")) {
  const widget = createHost()
  for (const plugin of PLUGINS) widget.ctx.use(plugin())
  widget.start()
}