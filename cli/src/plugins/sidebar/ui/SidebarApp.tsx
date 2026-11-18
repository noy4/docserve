import { useEffect } from "react"
import { PageList } from "./PageList.js"
import { PreviewModel } from "./preview-model.js"
import { SidebarHeader } from "./SidebarHeader.js"
import { useLayoutModel } from "./useModel.js"
import type { SidebarModel } from "../model.js"

export interface SidebarAppProps {
  model: SidebarModel
  docs?: DocsInfo
  currentPage: string
  onClose: () => void
}

export function SidebarApp({ model, docs, currentPage, onClose }: SidebarAppProps) {
  const previews = useLayoutModel(() => new PreviewModel())
  const pages = model.pages.value
  const status = model.status.value
  const view = model.view.value
  const open = model.open.value

  useEffect(() => {
    if (!open) return
    previews.element?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" })
  }, [open, pages, previews, view])

  return (
    <>
      <SidebarHeader
        docs={docs}
        view={view}
        files={status === "ready" ? pages.length : null}
        tabsVisible={status !== "error" && pages.length > 0}
        onView={(next) => model.setView(next)}
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
              ? <PageList pages={pages} view={view} currentPage={currentPage} previews={previews} />
              : <p className="docserve-sidebar__empty">No pages</p>}
      </nav>
    </>
  )
}
