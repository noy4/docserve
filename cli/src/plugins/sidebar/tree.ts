// Nested folder/file tree built from a flat list of paths.
import { decoded } from "../../widget/lib/dom.js"

/** One row in the tree: a folder or an item leaf. */
export interface TreeNode<T> {
  /** Display name (decoded last path segment). */
  name: string
  /** Root-relative path; also the collapse key. */
  path: string
  isFolder: boolean
  children: TreeNode<T>[]
  /** Set on leaves only. */
  data?: T
}

/**
 * Build a folder tree from a flat list. Folders come first at every level,
 * then entries are sorted by display name (natural number order).
 *
 * @param items    Flat entries, e.g. pages or assets.
 * @param getPath  Root-relative path for an entry, e.g. `/guides/intro.html`.
 */
export function buildTree<T>(items: readonly T[], getPath: (item: T) => string): TreeNode<T>[] {
  const root: TreeNode<T> = { name: "", path: "", isFolder: true, children: [] }
  const folders = new Map<string, TreeNode<T>>([["", root]])

  for (const item of items) {
    const parts = getPath(item).split("/").filter(Boolean)
    if (!parts.length) continue

    let parent = root
    let path = ""

    for (const part of parts.slice(0, -1)) {
      path = path ? `${path}/${part}` : part
      let folder = folders.get(path)
      if (!folder) {
        folder = { name: decoded(part), path, isFolder: true, children: [] }
        folders.set(path, folder)
        parent.children.push(folder)
      }
      parent = folder
    }

    const name = parts[parts.length - 1]
    parent.children.push({
      name: decoded(name),
      path: path ? `${path}/${name}` : name,
      isFolder: false,
      children: [],
      data: item,
    })
  }

  sortTree(root)

  return root.children
}

function sortTree<T>(node: TreeNode<T>): void {
  node.children.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  })

  for (const child of node.children) {
    if (child.isFolder) sortTree(child)
  }
}
