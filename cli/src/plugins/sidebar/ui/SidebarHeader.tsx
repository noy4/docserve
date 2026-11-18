import { ICON_CALENDAR, ICON_FOLDER, ICON_GRID, ICON_LIST, ICON_ROWS, ICON_SIDEBAR, ICON_TREE } from "../icons.js"
import type { SidebarGrouping, SidebarModel } from "../model.js"

const GROUPING = [
  { id: "none", icon: ICON_ROWS, label: "No grouping" },
  { id: "month", icon: ICON_CALENDAR, label: "By month" },
  { id: "folder", icon: ICON_FOLDER, label: "By folder" },
] satisfies { id: SidebarGrouping; icon: string; label: string }[]

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
          <div className="docserve-sidebar__views" role="group" aria-label="Grouping">
            {GROUPING.map(({ id, icon, label }) => (
              <button
                key={id}
                type="button"
                className="docserve-sidebar__view"
                aria-label={label}
                title={label}
                aria-pressed={grouping === id}
                onClick={() => model.setGrouping(id)}
                dangerouslySetInnerHTML={{ __html: icon }}
              />
            ))}
          </div>
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
