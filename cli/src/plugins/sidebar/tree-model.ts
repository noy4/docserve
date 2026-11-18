// Folder tree for the sidebar tree view: built from pages, plus collapse state.
import { computed } from "@preact/signals-react"
import type { Signal } from "@preact/signals-react"
import { persisted } from "../../widget/lib/persisted-signal.js"
import { buildTree } from "./tree.js"
import type { TreeNode } from "./tree.js"

export class TreeModel {
  /** Collapsed folder paths; folders are open by default. */
  readonly collapsed = persisted<string[]>("docserve:sidebar:collapsed", [])
  readonly nodes: Signal<TreeNode<DocPage>[]>

  constructor(pages: Signal<DocPage[]>) {
    this.nodes = computed(() => buildTree(pages.value, (page) => page.url))
  }

  toggleFolder(path: string): void {
    const current = this.collapsed.value
    this.collapsed.value = current.includes(path)
      ? current.filter((item) => item !== path)
      : [...current, path]
  }
}