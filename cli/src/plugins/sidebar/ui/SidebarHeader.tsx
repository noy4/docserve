import { ICON_CALENDAR, ICON_FOLDER, ICON_GRID, ICON_LIST, ICON_SIDEBAR } from "../icons.js"
import type { SidebarGrouping, SidebarView } from "../model.js"

export interface SidebarHeaderProps {
  docs?: DocsInfo
  view: SidebarView
  grouping: SidebarGrouping
  files: number | null
  tabsVisible: boolean
  onView: (view: SidebarView) => void
  onGrouping: (grouping: SidebarGrouping) => void
  onClose: () => void
}

export function SidebarHeader({ docs, view, grouping, files, tabsVisible, onView, onGrouping, onClose }: SidebarHeaderProps) {
  const name = docs?.name || "Pages"

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
          onClick={onClose}
          dangerouslySetInnerHTML={{ __html: ICON_SIDEBAR }}
        />
      </div>
      <div className="docserve-sidebar__sub">
        {docs && <code className="docserve-sidebar__path" title={docs.path}>{docs.path}</code>}
        <span className="docserve-sidebar__files">
          {files == null ? "" : `${files} ${files === 1 ? "file" : "files"}`}
        </span>
      </div>
      {tabsVisible && (
        <div className="docserve-sidebar__options">
          <button
            type="button"
            className="docserve-sidebar__view docserve-sidebar__group-toggle"
            aria-label="Group by month"
            title="Group by month"
            aria-pressed={grouping === "month"}
            onClick={() => onGrouping(grouping === "month" ? "none" : "month")}
            dangerouslySetInnerHTML={{ __html: ICON_CALENDAR }}
          />
          <div className="docserve-sidebar__views" role="group" aria-label="View">
            <button
              type="button"
              className="docserve-sidebar__view"
              aria-label="List view"
              title="List view"
              aria-pressed={view === "list"}
              onClick={() => onView("list")}
              dangerouslySetInnerHTML={{ __html: ICON_LIST }}
            />
            <button
              type="button"
              className="docserve-sidebar__view"
              aria-label="Gallery view"
              title="Gallery view"
              aria-pressed={view === "gallery"}
              onClick={() => onView("gallery")}
              dangerouslySetInnerHTML={{ __html: ICON_GRID }}
            />
          </div>
        </div>
      )}
    </header>
  )
}
