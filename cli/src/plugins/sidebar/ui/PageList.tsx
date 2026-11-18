import { useCallback, useState } from "react"
import { decoded, displayDate, pageUrl } from "../../../widget/lib/dom.js"
import type { PreviewModel } from "./preview-model.js"
import type { SidebarView } from "../model.js"

export interface PageListProps {
  pages: DocPage[]
  view: SidebarView
  currentPage: string
  previews?: PreviewModel
}

export function PageList({ pages, view, currentPage, previews }: PageListProps) {
  const target = pageUrl(currentPage)

  return pages.map((page) =>
    view === "gallery"
      ? <GalleryCard key={page.url} page={page} active={isActive(page, target, currentPage)} previews={previews} />
      : <ListRow key={page.url} page={page} active={isActive(page, target, currentPage)} />,
  )
}

function ListRow({ page, active }: { page: DocPage; active: boolean }) {
  return (
    <a
      className="docserve-sidebar__item"
      href={page.url}
      title={page.title}
      aria-current={active ? "page" : undefined}
    >
      <span className="docserve-sidebar__title">
        <Favicon src={page.favicon} />
        <span>{pageLabel(page)}</span>
      </span>
      <span className="docserve-sidebar__date">{displayDate(page.created)}</span>
    </a>
  )
}

function GalleryCard({ page, active, previews }: { page: DocPage; active: boolean; previews?: PreviewModel }) {
  const label = pageLabel(page)
  const setThumb = useCallback((element: HTMLDivElement | null) => previews?.watch(element), [previews])

  return (
    <a
      className="docserve-sidebar__card"
      href={page.url}
      title={page.title}
      aria-current={active ? "page" : undefined}
    >
      <div className="docserve-sidebar__thumb" ref={setThumb}>
        <iframe tabIndex={-1} title={label} data-src={page.url} />
      </div>
      <div className="docserve-sidebar__meta">
        <div className="docserve-sidebar__card-title">
          <Favicon src={page.favicon} />
          <span>{label}</span>
        </div>
        <div className="docserve-sidebar__card-date">{displayDate(page.created)}</div>
      </div>
    </a>
  )
}

function Favicon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null

  return (
    <img
      className="docserve-sidebar__favicon"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function isActive(page: DocPage, target: string, currentPage: string): boolean {
  return page.url === target || decoded(page.url) === `/${currentPage}`
}

function pageLabel(page: DocPage): string {
  return page.title || decoded(page.url)
}
