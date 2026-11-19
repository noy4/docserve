import { effect, signal } from "@preact/signals-react"

export const THUMB_W = 960

export interface PreviewModelOptions {
  max?: number
  rootMargin?: string
  scope?: "element" | "viewport"
}

interface QueueItem {
  iframe: HTMLIFrameElement
  src: string
}

export class PreviewModel {
  readonly #max: number
  readonly #rootMargin: string
  readonly #scope: "element" | "viewport"
  #root = signal<HTMLElement | null>(null)

  readonly setRoot = (element: HTMLElement | null): void => {
    this.#root.value = element
  }

  get element(): HTMLElement | null {
    return this.#root.value
  }

  #thumbs = new Set<HTMLElement>()
  #observer: IntersectionObserver | null = null
  #resize: ResizeObserver | null = null
  #queue: QueueItem[] = []
  #loads = new Map<HTMLIFrameElement, () => void>()
  #active = 0

  constructor(options: PreviewModelOptions = {}) {
    this.#max = options.max ?? 2
    this.#rootMargin = options.rootMargin ?? "150px"
    this.#scope = options.scope ?? "element"
  }

  subscribe(): () => void {
    const stop = effect(() => {
      const root = this.#root.value
      if (!root && this.#scope === "element") return

      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer.unobserve(entry.target)
          const iframe = entry.target.querySelector("iframe")
          const src = iframe?.getAttribute("data-src")
          if (!iframe || !src || iframe.hasAttribute("src")) continue
          this.#queue.push({ iframe, src })
          this.#pump()
        }
      }, { root, rootMargin: this.#rootMargin })

      const resize = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target instanceof HTMLElement) this.#fit(entry.target)
        }
      })

      this.#observer = observer
      this.#resize = resize
      for (const thumb of this.#thumbs) {
        observer.observe(thumb)
        resize.observe(thumb)
      }

      return () => {
        observer.disconnect()
        resize.disconnect()
        this.#observer = null
        this.#resize = null
        this.#reset()
      }
    })

    return () => {
      stop()
      this.#thumbs.clear()
    }
  }

  watch(thumb: HTMLElement | null): void | (() => void) {
    if (!thumb) return

    this.#thumbs.add(thumb)
    this.#observer?.observe(thumb)
    this.#resize?.observe(thumb)
    this.#fit(thumb)

    return () => {
      this.#thumbs.delete(thumb)
      this.#observer?.unobserve(thumb)
      this.#resize?.unobserve(thumb)

      const iframe = thumb.querySelector("iframe")
      if (!iframe) return
      this.#queue = this.#queue.filter((item) => item.iframe !== iframe)
      const load = this.#loads.get(iframe)
      if (!load) return
      iframe.removeEventListener("load", load)
      this.#loads.delete(iframe)
      this.#active = Math.max(0, this.#active - 1)
      this.#pump()
    }
  }

  #pump(): void {
    while (this.#active < this.#max && this.#queue.length) {
      const item = this.#queue.shift()
      if (!item || !item.iframe.isConnected) continue
      this.#active++

      const load = () => {
        this.#loads.delete(item.iframe)
        this.#active = Math.max(0, this.#active - 1)
        this.#pump()
      }

      this.#loads.set(item.iframe, load)
      item.iframe.addEventListener("load", load, { once: true })
      item.iframe.src = item.src
    }
  }

  #fit(thumb: HTMLElement): void {
    const iframe = thumb.querySelector("iframe")
    if (!iframe || !thumb.clientWidth) return

    const scale = thumb.clientWidth / THUMB_W
    iframe.style.width = `${THUMB_W}px`
    iframe.style.height = `${Math.round(thumb.clientHeight / scale)}px`
    iframe.style.transform = `scale(${scale})`
  }

  #reset(): void {
    this.#queue.length = 0
    this.#active = 0
    for (const [iframe, load] of this.#loads)
      iframe.removeEventListener("load", load)
    this.#loads.clear()
  }
}
