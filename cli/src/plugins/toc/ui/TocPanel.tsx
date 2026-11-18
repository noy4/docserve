import ICON_CLOSE_RAW from "~icons/lucide/x?raw&width=16&height=16"
import { iconSvg } from "../../../widget/lib/dom.js"
import type { TocEntry, TocModel } from "../model.js"

const ICON_CLOSE = iconSvg(ICON_CLOSE_RAW)

export interface TocPanelProps {
  model: TocModel
}

export function TocPanel({ model }: TocPanelProps) {
  const open = model.open.value
  const tree = model.tree.value
  const active = model.activeId.value

  return (
    <aside className="docserve-toc" data-open={open ? "" : undefined} aria-label="Table of contents">
      <header className="docserve-toc__head">
        <span className="docserve-toc__title">On this page</span>
        <button
          type="button"
          className="docserve-toc__close"
          title="Close table of contents"
          aria-label="Close table of contents"
          onClick={() => model.close()}
          dangerouslySetInnerHTML={{ __html: ICON_CLOSE }}
        />
      </header>
      <nav className="docserve-toc__scroll" ref={model.setScroll} aria-label="On this page">
        <div className="docserve-toc__content">
          <div className="docserve-toc__marker" ref={model.setMarker} aria-hidden="true" />
          {tree.length
            ? <TocList model={model} nodes={tree} active={active} />
            : <p className="docserve-toc__empty">No headings on this page</p>}
        </div>
      </nav>
    </aside>
  )
}

interface TocListProps {
  model: TocModel
  nodes: TocEntry[]
  active: string | null
}

function TocList({ model, nodes, active }: TocListProps) {
  return (
    <ul className="docserve-toc__list">
      {nodes.map((node, index) => (
        <TocItem
          key={`${node.id}:${index}`}
          model={model}
          entry={node}
          active={active}
        />
      ))}
    </ul>
  )
}

interface TocItemProps {
  model: TocModel
  entry: TocEntry
  active: string | null
}

function TocItem({ model, entry, active }: TocItemProps) {
  const isActive = entry.id === active

  return (
    <li className="docserve-toc__item">
      <a
        ref={model.linkRef(entry.id)}
        className={isActive ? "docserve-toc__link is-active" : "docserve-toc__link"}
        href={`#${entry.id}`}
        data-level={entry.level}
        aria-current={isActive ? "location" : undefined}
        onClick={(event) => model.navigate(event, entry.element)}
        dangerouslySetInnerHTML={{ __html: entry.html }}
      />
      {entry.children.length
        ? <TocList model={model} nodes={entry.children} active={active} />
        : null}
    </li>
  )
}
