import { useEffect, useLayoutEffect } from "react"
import type { CSSProperties } from "react"
import { PageList } from "./PageList.js"
import { PreviewModel } from "./preview-model.js"
import { SidebarHeader } from "./SidebarHeader.js"
import { useLayoutModel } from "./useModel.js"
import type { SidebarModel } from "../model.js"

export interface SidebarAppProps {
  model: SidebarModel
  docs?: DocsInfo
  currentPage: string
  width: string
  onClose: () => void
}

export function SidebarApp({ model, docs, currentPage, width, onClose }: SidebarAppProps) {
  const previews = useLayoutModel(() => new PreviewModel())
  const pages = model.pages.value
  const status = model.status.value
  const view = model.view.value
  const grouping = model.grouping.value
  const open = model.open.value

  const style = {
    width,
    ...(docs ? { "--docserve-sidebar-hue": String(docs.hue) } : {}),
  } as CSSProperties

  useLayoutEffect(() => {
    if (!open) return
    const html = document.documentElement
    html.style.setProperty("--docserve-panel-left", width)
    html.toggleAttribute("data-docserve-panel-left", true)

    return () => {
      html.style.removeProperty("--docserve-panel-left")
      html.toggleAttribute("data-docserve-panel-left", false)
    }
  }, [open, width])

  useEffect(() => {
    if (!open) return
    previews.element?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" })
  }, [open, pages, previews, view, grouping])

  return (
    <aside
      className="docserve-panel docserve-sidebar"
      data-side="left"
      data-open={open ? "" : undefined}
      data-view={view}
      data-grouping={grouping}
      aria-label={docs?.name || "Pages"}
      style={style}
    >
      <SidebarHeader
        docs={docs}
        view={view}
        grouping={grouping}
        files={status === "ready" ? pages.length : null}
        tabsVisible={status !== "error" && pages.length > 0}
        onView={(next) => model.setView(next)}
        onGrouping={(next) => model.setGrouping(next)}
        onClose={onClose}
      />
      <nav ref={previews.setRoot} className="docserve-sidebar__list" aria-label="Pages">
        {status === "error"
          ? (
              <div className="docserve-sidebar__empty">
                <p>Could not load pages</p>
                <button
                  type="button"
                  className="docserve-sidebar__retry"
                  onClick={() => model.load({ force: true })}
                >
                  Retry
                </button>
              </div>
            )
          : status === "loading" && !pages.length
            ? <p className="docserve-sidebar__empty">Loading…</p>
            : pages.length
              ? <PageList pages={pages} view={view} grouping={grouping} currentPage={currentPage} previews={previews} />
              : <p className="docserve-sidebar__empty">No pages</p>}
      </nav>
    </aside>
  )
}
