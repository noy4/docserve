import { effect, signal } from "@preact/signals-react"
import type { Signal } from "@preact/signals-react"
import { persisted, persistedBool } from "../../widget/lib/persisted-signal.js"
import type { CollapseCollect, CollapseSection } from "./sections.js"
import { applyState, mountSections } from "./view.js"

export class CollapseModel {
  readonly collapsed: Signal<string[]>
  readonly enabled: Signal<boolean>
  readonly sections = signal<CollapseSection[]>([])

  #wrappers: HTMLElement[] = []
  #mounted: CollapseSection[] | null = null
  #unmount: (() => void) | null = null

  constructor(page: string) {
    this.collapsed = persisted<string[]>(`docserve:collapse:${page}`, [])
    this.enabled = persistedBool("docserve:collapse:enabled", true)
  }

  static create(page: string): CollapseModel {
    return new CollapseModel(page)
  }

  load(collect: CollapseCollect): void {
    const ids = new Set(collect.sections.map((section) => section.id))
    const current = this.collapsed.value
    const next = current.filter((id) => ids.has(id))
    if (next.length !== current.length) this.collapsed.value = next

    this.#wrappers = collect.wrappers
    this.sections.value = collect.sections
  }

  subscribe(): () => void {
    const stop = effect(() => {
      const sections = this.sections.value
      const enabled = this.enabled.value

      if (enabled) {
        if (this.#mounted !== sections) {
          this.#unmount?.()
          this.#unmount = mountSections(sections, (id) => this.toggle(id))
          this.#mounted = sections
        }
      } else if (this.#unmount) {
        this.#unmount()
        this.#unmount = null
        this.#mounted = null
      }

      applyState(sections, this.collapsed.value, enabled)
    })

    return () => {
      stop()
      this.#unmount?.()
      this.#unmount = null
      this.#mounted = null

      const wrappers = this.#wrappers
      this.#wrappers = []
      for (const wrapper of wrappers.reverse()) {
        if (wrapper.isConnected) wrapper.replaceWith(...wrapper.childNodes)
      }
    }
  }

  toggleEnabled(): void {
    this.enabled.value = !this.enabled.value
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
    if (!this.enabled.value) return

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
    return this.enabled.value && this.collapsed.value.includes(id)
  }
}
