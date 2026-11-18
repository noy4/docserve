import ICON_TOC_RAW from "~icons/lucide/list-tree?raw&width=18&height=18"
import { createDisposables } from "../../widget/lib/disposables.js"
import { iconSvg } from "../../widget/lib/dom.js"
import { persistedBool } from "../../widget/lib/persisted-signal.js"
import { buildTree, collectOutline } from "./outline.js"
import { createPanel } from "./panel.js"

const ICON_TOC = iconSvg(ICON_TOC_RAW)
const OFFSET = 88

/**
 * @returns {DocservePlugin}
 */
export function tocPlugin() {
  return {
    id: "toc",
    setup(ctx) {
      const source = document.body ?? document.documentElement
      const html = document.documentElement
      const { headings } = collectOutline(document)
      const open = persistedBool("docserve:toc:open", source?.hasAttribute("data-toc-open") ?? false)
      const cleanup = createDisposables()
      const controller = new AbortController()
      const { signal } = controller

      let activeFrame = 0

      ctx.ui.style("/__docserve/plugins/toc/toc.css")

      const panel = createPanel({
        onClose: () => setOpen(false),
        onNavigate: navigate,
      })
      panel.setTree(buildTree(headings))

      const mount = ctx.ui.mountPoint()
      mount.append(panel.element)

      const offCommand = ctx.commands.register({
        id: "plugin:toc:toggle",
        title: "Toggle table of contents",
        category: "View",
        icon: ICON_TOC,
        keys: ["t"],
        run: () => setOpen(!open.value),
      })

      const offClose = ctx.commands.register({
        id: "plugin:toc:close",
        title: "Close table of contents",
        keys: ["Escape"],
        showInPalette: false,
        when: () => open.value,
        run: () => setOpen(false),
      })

      const dock = ctx.docks.register({
        id: "toc",
        title: "Toggle table of contents",
        icon: ICON_TOC,
        category: "main",
        order: 1,
        command: "plugin:toc:toggle",
        isActive: () => open.value,
      })

      const offOpen = open.subscribe(sync)

      window.addEventListener("scroll", scheduleActive, { passive: true, signal })
      window.addEventListener("resize", scheduleActive, { passive: true, signal })

      scheduleActive()

      cleanup.add(() => controller.abort())
      cleanup.add(() => {
        if (activeFrame) cancelAnimationFrame(activeFrame)
      })
      cleanup.add(offOpen)
      cleanup.add(() => dock.dispose())
      cleanup.add(offClose)
      cleanup.add(offCommand)
      cleanup.add(() => {
        html.removeAttribute("data-docserve-panel-right")
      })
      cleanup.add(() => panel.destroy())
      cleanup.add(() => mount.remove())

      return cleanup.dispose

      function setOpen(next) {
        open.value = next
      }

      function sync() {
        const isOpen = open.value

        html.toggleAttribute("data-docserve-panel-right", isOpen)
        panel.setOpen(isOpen)
        dock.update()
      }

      function scheduleActive() {
        if (activeFrame) return
        activeFrame = requestAnimationFrame(() => {
          activeFrame = 0
          updateActive()
        })
      }

      function updateActive() {
        let current = headings[0] ?? null
        for (const heading of headings) {
          if (heading.getBoundingClientRect().top > OFFSET) break
          current = heading
        }
        panel.setActive(current?.id ?? null)
      }

      function navigate(element) {
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
        const top = window.scrollY + element.getBoundingClientRect().top - OFFSET

        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" })
        history.replaceState(null, "", `#${element.id}`)
        panel.setActive(element.id)
      }
    },
  }
}
