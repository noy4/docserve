// Dock link back to the gallery.
import { iconSvg } from "../../widget/lib/dom.js"
import ICON_HOME_RAW from "~icons/lucide/house?raw&width=18&height=18"

const ICON_HOME = iconSvg(ICON_HOME_RAW)

/**
 * @returns {DocservePlugin}
 */
export function homePlugin() {
  return {
    id: "home",
    setup(ctx) {
      const dock = ctx.docks.register({
        id: "home",
        title: "Back to gallery",
        icon: ICON_HOME,
        href: "/",
        category: "actions",
      })
      return () => dock.dispose()
    },
  }
}
