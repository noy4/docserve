// Widget entry: register the built-in plugins, then start.
import { collapsePlugin } from "../plugins/collapse/client.js"
import { copyPlugin } from "../plugins/copy/client.js"
import { homePlugin } from "../plugins/home/client.js"
import { sidebarPlugin } from "../plugins/sidebar/client.js"
import { tocPlugin } from "../plugins/toc/client.js"
import { createHost } from "./host.js"

const PLUGINS = [
  homePlugin,
  copyPlugin,
  sidebarPlugin,
  tocPlugin,
  collapsePlugin,
]

// The server skips iframe previews; this guard covers pages served some other way.
if (window.self === window.top && !document.getElementById("docserve-dock-host")) {
  const widget = createHost()
  for (const plugin of PLUGINS) widget.use(plugin())
  widget.start()
}