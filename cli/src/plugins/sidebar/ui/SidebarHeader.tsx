import { ICON_CALENDAR, ICON_FOLDER, ICON_GRID, ICON_LIST, ICON_SIDEBAR, ICON_TREE } from "../icons.js"
import type { SidebarModel } from "../model.js"

export interface SidebarHeaderProps {
  model: SidebarModel
}

export function SidebarHeader({ model }: SidebarHeaderProps) {
  const docs = model.docs
  const name = docs?.name || "Pages"
  const view = model.view.value
  const grouping = model.grouping.value
  const pages = model.pages.value
  const files = model.status.value === "ready" ? pages.length : null

  return (
    <header className="docserve-sidebar__head">
      <div className="docserve-sidebar__title">
        <a className="docserve-sidebar__home" href="/" title="Open gallery">
          <span className="docserve-sidebar__icon" dangerouslySetInnerHTML={{ __html: ICON_FOLDER }} />
          <span className="docserve-sidebar__name" title={name}>{name}</span>
        </a>
        <button
          type="button"
          className="docserve-sidebar__close"
          aria-label="Close sidebar"
          title="Close sidebar"
          onClick={() => model.setOpen(false)}
          dangerouslySetInnerHTML={{ __html: ICON_SIDEBAR }}
        />
      </div>
      <div className="docserve-sidebar__sub">
        {docs && <code className="docserve-sidebar__path" title={docs.path}>{docs.path}</code>}
        <span className="docserve-sidebar__files">
          {files == null ? "" : `${files} ${files === 1 ? "file" : "files"}`}
        </span>
      </div>
      <div className="docserve-sidebar__options">
        {view !== "tree" && (
          <button
            type="button"
            className="docserve-sidebar__view docserve-sidebar__group-toggle"
            aria-label="Group by month"
            title="Group by month"
            aria-pressed={grouping === "month"}
            onClick={() => model.toggleGrouping()}
            dangerouslySetInnerHTML={{ __html: ICON_CALENDAR }}
          />
        )}
        <div className="docserve-sidebar__views" role="group" aria-label="View">
          <button
            type="button"
            className="docserve-sidebar__view"
            aria-label="List view"
            title="List view"
            aria-pressed={view === "list"}
            onClick={() => model.setView("list")}
            dangerouslySetInnerHTML={{ __html: ICON_LIST }}
          />
          <button
            type="button"
            className="docserve-sidebar__view"
            aria-label="Gallery view"
            title="Gallery view"
            aria-pressed={view === "gallery"}
            onClick={() => model.setView("gallery")}
            dangerouslySetInnerHTML={{ __html: ICON_GRID }}
          />
          <button
            type="button"
            className="docserve-sidebar__view"
            aria-label="Tree view"
            title="Tree view"
            aria-pressed={view === "tree"}
            onClick={() => model.setView("tree")}
            dangerouslySetInnerHTML={{ __html: ICON_TREE }}
          />
        </div>
      </div>
    </header>
  )
}
