import { effect, signal } from "@preact/signals-react"
import type { MouseEvent } from "react"
import { persistedBool } from "../../widget/lib/persisted-signal.js"
import { headingHtml } from "./heading-html.js"
import { buildTree, collectOutline } from "./outline.js"

export const HEADING_OFFSET = 88

export interface TocEntry {
  element: HTMLHeadingElement
  id: string
  level: number
  html: string
  children: TocEntry[]
}

type OutlineNode = ReturnType<typeof buildTree>[number]

export class TocModel {
  readonly open: ReturnType<typeof persistedBool>
  readonly headings = signal<HTMLHeadingElement[]>([])
  readonly tree = signal<TocEntry[]>([])
  readonly activeId = signal<string | null>(null)
  readonly marker = signal<HTMLElement | null>(null)
  readonly scroll = signal<HTMLElement | null>(null)

  #links = new Map<string, HTMLAnchorElement>()
  #linkRefs = new Map<string, (element: HTMLAnchorElement | null) => void>()

  constructor(defaultOpen = false) {
    this.open = persistedBool("docserve:toc:open", defaultOpen)
  }

  static create(): TocModel {
    const source = document.body ?? document.documentElement
    return new TocModel(source?.hasAttribute("data-toc-open") ?? false)
  }

  load(): void {
    this.#links.clear()
    this.#linkRefs.clear()

    const { headings } = collectOutline(document)
    this.headings.value = headings
    this.tree.value = buildEntries(buildTree(headings))
    this.activeId.value = null
    this.layout()
  }

  toggle(): void {
    this.setOpen(!this.open.value)
  }

  setOpen(next: boolean): void {
    this.open.value = next
    if (!next) return

    this.layout()
    const link = this.activeId.value ? this.#links.get(this.activeId.value) : null
    if (link) this.#reveal(link)
  }

  close(): void {
    this.setOpen(false)
  }

  setActive(id: string | null): void {
    if (id === this.activeId.value) return

    this.activeId.value = id
    this.layout()

    const link = id ? this.#links.get(id) : null
    if (link) this.#reveal(link)
  }

  navigate(event: MouseEvent<HTMLAnchorElement>, element: HTMLHeadingElement): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    const top = window.scrollY + element.getBoundingClientRect().top - HEADING_OFFSET

    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" })
    history.replaceState(null, "", `#${element.id}`)
    this.setActive(element.id)
  }

  layout(): void {
    const marker = this.marker.value
    if (!marker) return

    const active = this.activeId.value ? this.#links.get(this.activeId.value) : null
    if (!active) {
      marker.style.opacity = "0"
      return
    }

    const top = active.offsetTop + (active.offsetHeight - marker.offsetHeight) / 2
    marker.style.transform = `translateY(${top}px)`
    marker.style.opacity = "1"
  }

  linkRef(id: string): (element: HTMLAnchorElement | null) => void {
    let ref = this.#linkRefs.get(id)
    if (!ref) {
      ref = (element) => {
        if (element) {
          this.#links.set(id, element)
          if (id === this.activeId.value) this.#reveal(element)
        } else {
          this.#links.delete(id)
        }
        this.layout()
      }
      this.#linkRefs.set(id, ref)
    }
    return ref
  }

  readonly setMarker = (element: HTMLElement | null): void => {
    this.marker.value = element
    this.layout()
  }

  readonly setScroll = (element: HTMLElement | null): void => {
    this.scroll.value = element
    const link = this.activeId.value ? this.#links.get(this.activeId.value) : null
    if (link) this.#reveal(link)
  }

  subscribe(): () => void {
    if (typeof ResizeObserver !== "function") return () => {}

    return effect(() => {
      const marker = this.marker.value
      const target = marker?.parentElement
      if (!target) return

      const observer = new ResizeObserver(() => this.layout())
      observer.observe(target)
      return () => observer.disconnect()
    })
  }

  #reveal(link: HTMLAnchorElement): void {
    const scroll = this.scroll.value
    if (!scroll || !this.open.value) return

    const top = link.offsetTop
    const bottom = top + link.offsetHeight
    if (top < scroll.scrollTop + 4)
      scroll.scrollTop = Math.max(0, top - 8)
    else if (bottom > scroll.scrollTop + scroll.clientHeight - 4)
      scroll.scrollTop = bottom - scroll.clientHeight + 8
  }
}

function buildEntries(nodes: OutlineNode[]): TocEntry[] {
  return nodes.map((node) => ({
    element: node.element,
    id: node.element.id,
    level: node.level,
    html: headingHtml(node.element),
    children: buildEntries(node.children),
  }))
}
