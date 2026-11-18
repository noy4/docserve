import { decoded, pageUrl } from "../../../widget/lib/dom.js"
import type { CSSProperties } from "react"
import { ICON_CHEVRON, ICON_FILE } from "../icons.js"
import type { TreeModel } from "../tree-model.js"
import type { TreeNode } from "../tree.js"
import { Favicon } from "./PageList.js"

export interface TreeListProps {
  model: TreeModel
  currentPage: string
}

export function TreeList({ model, currentPage }: TreeListProps) {
  const nodes = model.nodes.value
  const collapsed = new Set(model.collapsed.value)
  const target = pageUrl(currentPage)

  if (!nodes.length)
    return <p className="docserve-sidebar__empty">No pages</p>

  return (
    <div className="docserve-sidebar__tree" role="tree" aria-label="Pages">
      {nodes.map((node) => (
        <TreeRow
          key={node.path}
          node={node}
          depth={0}
          collapsed={collapsed}
          model={model}
          target={target}
          currentPage={currentPage}
        />
      ))}
    </div>
  )
}

interface TreeRowProps {
  node: TreeNode<DocPage>
  depth: number
  collapsed: Set<string>
  model: TreeModel
  target: string
  currentPage: string
}

function TreeRow({ node, depth, collapsed, model, target, currentPage }: TreeRowProps) {
  // One 16px slot per row: a chevron for folders, an icon for pages. Both
  // start at the same offset, so every label lines up column for column.
  const style = { paddingLeft: `${8 + depth * 14}px` }

  if (node.isFolder) {
    const open = !collapsed.has(node.path)

    return (
      <div className="docserve-sidebar__tree-branch" role="none">
        <button
          type="button"
          className="docserve-sidebar__tree-row docserve-sidebar__tree-row--folder"
          role="treeitem"
          aria-expanded={open}
          aria-level={depth + 1}
          style={style}
          onClick={() => model.toggleFolder(node.path)}
        >
          <span
            className="docserve-sidebar__tree-slot docserve-sidebar__tree-caret"
            data-open={open ? "" : undefined}
            dangerouslySetInnerHTML={{ __html: ICON_CHEVRON }}
          />
          <span className="docserve-sidebar__tree-label">{node.name}</span>
        </button>
        {open && (
          <div
            className="docserve-sidebar__tree-group"
            role="group"
            style={{ "--docserve-tree-guide": `${16 + depth * 14}px` } as CSSProperties}
          >
            {node.children.map((child) => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                model={model}
                target={target}
                currentPage={currentPage}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const page = node.data
  if (!page) return null

  const active = isActive(page, target, currentPage)

  return (
    <a
      className="docserve-sidebar__tree-row docserve-sidebar__tree-row--page"
      role="treeitem"
      aria-level={depth + 1}
      aria-current={active ? "page" : undefined}
      href={page.url}
      title={page.title}
      style={style}
    >
      {page.favicon ? (
        <span className="docserve-sidebar__tree-slot docserve-sidebar__tree-icon">
          <Favicon src={page.favicon} />
        </span>
      ) : (
        <span
          className="docserve-sidebar__tree-slot docserve-sidebar__tree-icon"
          dangerouslySetInnerHTML={{ __html: ICON_FILE }}
        />
      )}
      <span className="docserve-sidebar__tree-label">{node.name}</span>
    </a>
  )
}

function isActive(page: DocPage, target: string, currentPage: string): boolean {
  return page.url === target || decoded(page.url) === `/${currentPage}`
}