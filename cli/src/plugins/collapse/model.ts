import { effect, signal } from "@preact/signals-react"
import type { Signal } from "@preact/signals-react"
import { persisted } from "../../widget/lib/persisted-signal.js"
import type { CollapseSection } from "./sections.js"
import { applyState } from "./view.js"

export class CollapseModel {
  readonly collapsed: Signal<string[]>
  readonly sections = signal<CollapseSection[]>([])

  constructor(page: string) {
    this.collapsed = persisted<string[]>(`docserve:collapse:${page}`, [])
  }

  static create(page: string): CollapseModel {
    return new CollapseModel(page)
  }

  load(sections: CollapseSection[]): void {
    const ids = new Set(sections.map((section) => section.id))
    const current = this.collapsed.value
    const next = current.filter((id) => ids.has(id))
    if (next.length !== current.length) this.collapsed.value = next

    this.sections.value = sections
  }

  subscribe(): () => void {
    return effect(() => applyState(this.sections.value, this.collapsed.value))
  }

  toggle(id: string): void {
    const collapsed = new Set(this.collapsed.value)
    if (collapsed.has(id)) collapsed.delete(id)
    else collapsed.add(id)
    this.collapsed.value = [...collapsed]
  }

  expand(id: string): void {
    this.collapsed.value = this.collapsed.value.filter((item) => item !== id)
  }

  collapse(id: string): void {
    if (this.isCollapsed(id)) return
    this.collapsed.value = [...this.collapsed.value, id]
  }

  expandAncestors(id: string): void {
    let section = this.sections.value.find((item) => item.id === id)?.parent ?? null
    if (!section) return

    const collapsed = new Set(this.collapsed.value)
    let changed = false
    while (section) {
      if (collapsed.delete(section.id)) changed = true
      section = section.parent
    }

    if (changed) this.collapsed.value = [...collapsed]
  }

  toggleAll(): void {
    const sections = this.sections.value
    const collapsed = new Set(this.collapsed.value)
    const allCollapsed = sections.every((section) => collapsed.has(section.id))
    this.collapsed.value = allCollapsed ? [] : sections.map((section) => section.id)
  }

  collapseAll(): void {
    this.collapsed.value = this.sections.value.map((section) => section.id)
  }

  expandAll(): void {
    this.collapsed.value = []
  }

  isCollapsed(id: string): boolean {
    return this.collapsed.value.includes(id)
  }
}
