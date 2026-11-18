import { useCallback, useState } from "react"
import { decoded, displayDate, pageUrl } from "../../../widget/lib/dom.js"
import { groupByMonth } from "../grouping.js"
import type { PreviewModel } from "./preview-model.js"
import type { SidebarModel, SidebarView } from "../model.js"

export interface PageListProps {
  model: SidebarModel
  previews?: PreviewModel
}

export function PageList({ model, previews }: PageListProps) {
  const pages = model.pages.value
  const view = model.view.value
  const grouping = model.grouping.value
  const currentPage = model.currentPage
  const target = pageUrl(currentPage)

  if (grouping !== "month")
    return pages.map((page) => (
      <PageItem
        key={itemKey(page, view)}
        page={page}
        view={view}
        target={target}
        currentPage={currentPage}
        previews={previews}
      />
    ))

  return groupByMonth(pages).map((group) => {
    const id = groupHeadingId(group.key)

    return (
      <section key={group.key || "undated"} className="docserve-sidebar__group" aria-labelledby={id}>
        <h2 className="docserve-sidebar__group-head" id={id}>
          <span>{group.label}</span>
          <span className="docserve-sidebar__group-count">{group.pages.length}</span>
        </h2>
        <div className="docserve-sidebar__group-body">
          {group.pages.map((page) => (
            <PageItem
              key={itemKey(page, view)}
              page={page}
              view={view}
              target={target}
              currentPage={currentPage}
              previews={previews}
            />
          ))}
        </div>
      </section>
    )
  })
}

interface PageItemProps {
  page: DocPage
  view: SidebarView
  target: string
  currentPage: string
  previews?: PreviewModel
}

function PageItem({ page, view, target, currentPage, previews }: PageItemProps) {
  const active = isActive(page, target, currentPage)

  return view === "gallery"
    ? <GalleryCard page={page} active={active} previews={previews} />
    : <ListRow page={page} active={active} />
}

function itemKey(page: DocPage, view: SidebarView): string {
  return view === "gallery" ? pageKey(page) : page.url
}

function groupHeadingId(key: string): string {
  return `docserve-sidebar-group-${key || "undated"}`
}

function pageKey(page: DocPage): string {
  return `${page.url}:${page.modified ?? page.created}`
}

function ListRow({ page, active }: { page: DocPage; active: boolean }) {
  const date = displayDate(page.created)

  return (
    <a
      className="docserve-sidebar__item"
      href={page.url}
      title={date ? `${page.title} — ${date}` : page.title}
      aria-current={active ? "page" : undefined}
    >
      <span className="docserve-sidebar__title">
        <Favicon src={page.favicon} />
        <span>{pageLabel(page)}</span>
      </span>
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

export function Favicon({ src }: { src?: string }) {
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
