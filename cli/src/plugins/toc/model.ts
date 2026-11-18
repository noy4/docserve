import { signal } from "@preact/signals-react"
import { persistedBool } from "../../widget/lib/persisted-signal.js"
import { buildTree, collectOutline } from "./outline.js"

export class TocModel {
  readonly open: ReturnType<typeof persistedBool>
  readonly headings = signal<HTMLHeadingElement[]>([])
  readonly tree = signal<ReturnType<typeof buildTree>>([])
  readonly activeId = signal<string | null>(null)

  constructor(defaultOpen = false) {
    this.open = persistedBool("docserve:toc:open", defaultOpen)
  }

  static create(): TocModel {
    const source = document.body ?? document.documentElement
    return new TocModel(source?.hasAttribute("data-toc-open") ?? false)
  }

  load(): void {
    const { headings } = collectOutline(document)
    this.headings.value = headings
    this.tree.value = buildTree(headings)
  }

  toggle(): void {
    this.setOpen(!this.open.value)
  }

  setOpen(next: boolean): void {
    this.open.value = next
  }

  setActive(id: string | null): void {
    if (id !== this.activeId.value) this.activeId.value = id
  }
}
