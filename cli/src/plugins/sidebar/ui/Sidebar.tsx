import { useEffect, useLayoutEffect } from "react"
import type { CSSProperties } from "react"
import { PageList } from "./PageList.js"
import { PreviewModel } from "./preview-model.js"
import { SidebarHeader } from "./SidebarHeader.js"
import { useLayoutModel } from "./useModel.js"
import type { SidebarModel } from "../model.js"

export interface SidebarProps {
  model: SidebarModel
  width: string
}

export function Sidebar({ model, width }: SidebarProps) {
  const docs = model.docs
  const previews = useLayoutModel(() => new PreviewModel())
  const pages = model.pages.value
  const status = model.status.value
  const view = model.view.value
  const grouping = model.grouping.value
  const open = model.open.value

  const style = {
    width,
    ...(docs && { "--docserve-sidebar-hue": String(docs.hue) }),
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
  }, [open, pages, view, grouping])

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
      <SidebarHeader model={model} />
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
              ? <PageList model={model} previews={previews} />
              : <p className="docserve-sidebar__empty">No pages</p>}
      </nav>
    </aside>
  )
}
