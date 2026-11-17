// Lazy iframe previews for the gallery view: observed against the scrolling
// list, at most MAX_PREVIEWS loading at once.

export const THUMB_W = 960
const MAX_PREVIEWS = 2

/**
 * @param {HTMLElement} root
 */
export function createPreviews(root) {
  /** @type {{ iframe: HTMLIFrameElement, src: string }[]} */
  const queue = []
  let active = 0

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      observer.unobserve(entry.target)
      const iframe = entry.target.querySelector("iframe")
      const src = iframe?.getAttribute("data-src")
      if (iframe && src) {
        queue.push({ iframe: /** @type {HTMLIFrameElement} */ (iframe), src })
        pump()
      }
    }
  }, { root, rootMargin: "150px" })

  function pump() {
    while (active < MAX_PREVIEWS && queue.length) {
      const item = queue.shift()
      if (!item || !item.iframe.isConnected) continue
      active++
      item.iframe.addEventListener("load", () => {
        active = Math.max(0, active - 1)
        pump()
      }, { once: true })
      item.iframe.src = item.src
    }
  }

  return {
    /** @param {HTMLElement} thumb */
    watch(thumb) {
      observer.observe(thumb)
    },
    fit() {
      for (const thumb of root.querySelectorAll(".docserve-sidebar__thumb")) {
        const iframe = thumb.querySelector("iframe")
        if (!iframe || !thumb.clientWidth) continue
        const scale = thumb.clientWidth / THUMB_W
        iframe.style.width = `${THUMB_W}px`
        iframe.style.height = `${Math.round(thumb.clientHeight / scale)}px`
        iframe.style.transform = `scale(${scale})`
      }
    },
    reset() {
      observer.disconnect()
      queue.length = 0
      active = 0
    },
  }
}
