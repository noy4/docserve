// Dock action: copy the current page's absolute path.
import { icon, writeClipboard } from "../../widget/dom.js"

const ICON_COPY = icon('<rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />', { class: "docserve-icon-copy" })
const ICON_CHECK = icon('<path d="m20 6-11 11-5-5" />', { class: "docserve-icon-check", width: 2.5 })

/**
 * @returns {DocservePlugin}
 */
export function copyPlugin() {
  return {
    id: "copy",
    setup(ctx) {
      /** @type {ReturnType<typeof setTimeout> | null} */
      let resetTimer = null
      /** @type {DockItemHandle | null} */
      let handle = null

      ctx.ui.style("/__docserve/plugins/copy/copy.css")

      handle = ctx.dock.add({
        id: "copy",
        label: "Copy file path",
        icon: ICON_COPY + ICON_CHECK,
        order: 10,
        group: "actions",
        async onClick() {
          const file = /** @type {DocPage | null} */ (await ctx.rpc.call("docserve:pages:resolve", ctx.page))
          const text = file?.filePath ?? location.href
          try {
            await writeClipboard(text)
            flash("copied")
            ctx.ui.announce("File path copied")
          } catch {
            ctx.ui.announce("Copy failed")
          }
        },
      })

      return () => {
        if (resetTimer) clearTimeout(resetTimer)
        handle?.remove()
      }

      /**
       * @param {"copied" | ""} state
       */
      function flash(state) {
        const element = handle?.element
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