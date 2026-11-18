// Dock action: copy the current page's absolute path.
import ICON_CHECK_RAW from "~icons/lucide/check?raw&width=18&height=18"
import ICON_COPY_RAW from "~icons/lucide/copy?raw&width=18&height=18"
import { iconSvg, writeClipboard } from "../../widget/lib/dom.js"

const ICON_COPY = iconSvg(ICON_COPY_RAW, "docserve-icon-copy")
const ICON_CHECK = iconSvg(ICON_CHECK_RAW, "docserve-icon-check")

/**
 * @returns {DocservePlugin}
 */
export function copyPlugin() {
  return {
    id: "copy",
    setup(ctx) {
      /** @type {ReturnType<typeof setTimeout> | null} */
      let resetTimer = null

      ctx.ui.style("/__docserve/plugins/copy/copy.css")

      const offCopy = ctx.commands.register({
        id: "plugin:copy:path",
        title: "Copy file path",
        description: "Absolute path of this page",
        category: "Actions",
        icon: ICON_COPY,
        keys: ["c"],
        run: copyPath,
      })

      const dock = ctx.docks.register({
        id: "copy",
        title: "Copy file path",
        icon: ICON_COPY + ICON_CHECK,
        category: "actions",
        command: "plugin:copy:path",
      })

      return () => {
        offCopy()
        if (resetTimer) clearTimeout(resetTimer)
        dock.dispose()
      }

      async function copyPath() {
        const file = /** @type {DocPage | null} */ (await ctx.rpc.call("docserve:pages:resolve", ctx.page))
        const text = file?.filePath ?? location.href
        try {
          await writeClipboard(text)
          flash("copied")
          ctx.ui.announce("File path copied")
        } catch {
          ctx.ui.announce("Copy failed")
        }
      }

      /**
       * @param {"copied" | ""} state
       */
      function flash(state) {
        const element = dock.element
        if (!element) return
        element.dataset.state = state
        if (resetTimer) clearTimeout(resetTimer)
        resetTimer = setTimeout(() => {
          element.dataset.state = ""
          resetTimer = null
        }, 1200)
      }
    },
  }
}