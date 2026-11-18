// Dock link back to the gallery.
import { icon } from "../../widget/lib/dom.js"

const ICON_HOME = icon('<path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" />')

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