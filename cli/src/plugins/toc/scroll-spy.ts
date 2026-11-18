import type { TocModel } from "./model.js"

export function startScrollSpy(model: TocModel, offset = 88): () => void {
  const controller = new AbortController()
  let frame = 0

  window.addEventListener("scroll", schedule, { passive: true, signal: controller.signal })
  window.addEventListener("resize", schedule, { passive: true, signal: controller.signal })

  schedule()

  return () => {
    controller.abort()
    if (frame) cancelAnimationFrame(frame)
  }

  function schedule(): void {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      update()
    })
  }

  function update(): void {
    const headings = model.headings.value
    let current = headings[0] ?? null
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top > offset) break
      current = heading
    }
    model.setActive(current?.id ?? null)
  }
}
