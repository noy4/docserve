// Sidebar width, persisted and clamped to the allowed range.
import { signal } from "@preact/signals-react"
import type { PointerEvent } from "react"
import { persisted } from "../../widget/lib/persisted-signal.js"

export const DEFAULT_WIDTH = 280
export const MIN_WIDTH = 220
export const MAX_WIDTH = 560

export class ResizeModel {
  readonly width = persisted<number>("docserve:sidebar:width", DEFAULT_WIDTH, {
    parse: (raw) => {
      const value = Number(raw)
      return Number.isFinite(value) ? clampWidth(value) : DEFAULT_WIDTH
    },
  })
  readonly resizing = signal(false)

  setWidth(next: number): void {
    this.width.value = clampWidth(next)
  }

  readonly start = (event: PointerEvent<HTMLElement>): void => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    this.resizing.value = true
  }

  readonly move = (event: PointerEvent<HTMLElement>): void => {
    if (!this.resizing.value) return
    this.setWidth(Math.min(event.clientX, window.innerWidth * 0.86))
  }

  readonly stop = (event: PointerEvent<HTMLElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    this.end()
  }

  readonly end = (): void => {
    this.resizing.value = false
  }
}

export function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)))
}
