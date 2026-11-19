// Placement: four viewport corners, drag the pill to move between them, and the
// choice is remembered across loads.
import { persisted } from "../lib/storage.js"

const STORAGE_KEY = "docserve:dock-corner"
/** Travel before a press counts as a drag, so clicks still click. */
const DRAG_THRESHOLD = 4
/** Gap from the viewport edge while dragging; the corner rest position is set in CSS. */
const DRAG_MARGIN = 8

/**
 * @typedef {object} DragState
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 * @property {boolean} moved
 */

/**
 * @param {object} options
 * @param {HTMLElement} options.host  Shadow host; carries `data-corner`.
 * @param {HTMLElement} options.handle   The dock pill, used as the drag surface.
 * @returns {{ corner: () => string, destroy: () => void }}
 */
export function createPlacement({ host, handle }) {
  const saved = persisted(STORAGE_KEY, "br")
  host.dataset.corner = saved.value

  /** @type {DragState | null} */
  let drag = null
  // A drag that ends over a button must not also activate it.
  let swallowClick = false
  /** @type {ReturnType<typeof setTimeout> | null} */
  let settleTimer = null

  handle.addEventListener("pointerdown", onDown)
  host.addEventListener("click", onClick, true)
  window.addEventListener("blur", cancel)

  return {
    corner() {
      return host.dataset.corner ?? "br"
    },
    destroy,
  }

  /**
   * @param {PointerEvent} event
   */
  function onDown(event) {
    if (drag || !event.isPrimary || event.button !== 0) return
    swallowClick = false
    if (settleTimer) settle()

    const rect = host.getBoundingClientRect()
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    }

    // Track on the window instead of capturing the pointer: an active pointer
    // capture retargets the click to the capture element, which would swallow
    // every button press.
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", cancel)
  }

  /**
   * @param {PointerEvent} event
   */
  function onMove(event) {
    if (!drag || event.pointerId !== drag.id) return

    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      drag.moved = true
      host.toggleAttribute("data-dragging", true)
    }

    // Follow the pointer in px; corners are re-applied on release.
    const maxLeft = Math.max(DRAG_MARGIN, window.innerWidth - drag.width - DRAG_MARGIN)
    const maxTop = Math.max(DRAG_MARGIN, window.innerHeight - drag.height - DRAG_MARGIN)
    host.style.left = `${clamp(drag.left + dx, DRAG_MARGIN, maxLeft)}px`
    host.style.top = `${clamp(drag.top + dy, DRAG_MARGIN, maxTop)}px`
    host.style.right = "auto"
    host.style.bottom = "auto"
    event.preventDefault()
  }

  /**
   * @param {PointerEvent} event
   */
  function onUp(event) {
    if (!drag || event.pointerId !== drag.id) return
    const moved = drag.moved
    const from = host.getBoundingClientRect()
    finish()
    if (!moved) return
    swallowClick = true

    // Snap to the corner nearest the drop point.
    const vertical = from.top + from.height / 2 < window.innerHeight / 2 ? "t" : "b"
    const horizontal = from.left + from.width / 2 < window.innerWidth / 2 ? "l" : "r"
    snap(`${vertical}${horizontal}`, from)
  }

  /**
   * Glide from the drop point to the corner. The resting rules switch the free
   * axis to `auto`, which CSS cannot interpolate, so both ends are measured in
   * px here and the travel is animated explicitly.
   * @param {string} corner
   * @param {DOMRect} from
   */
  function snap(corner, from) {
    host.style.transition = "none"
    host.dataset.corner = corner
    saved.value = corner
    clearInline()
    const to = host.getBoundingClientRect()

    host.style.right = "auto"
    host.style.bottom = "auto"
    host.style.left = `${from.left}px`
    host.style.top = `${from.top}px`
    void host.offsetWidth // commit the start, so the change below animates

    host.style.transition = ""
    host.style.left = `${to.left}px`
    host.style.top = `${to.top}px`
    host.addEventListener("transitionend", settle, { once: true })
    settleTimer = setTimeout(settle, 250)
  }

  // Hand positioning back to the corner rules once the glide is over.
  function settle() {
    if (settleTimer) clearTimeout(settleTimer)
    settleTimer = null
    host.removeEventListener("transitionend", settle)
    if (drag) return
    host.style.removeProperty("transition")
    clearInline()
  }

  function cancel() {
    if (!drag) return
    const moved = drag.moved
    finish()
    if (moved) clearInline()
  }

  function finish() {
    if (!drag) return
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", cancel)
    drag = null
    host.toggleAttribute("data-dragging", false)
  }

  function clearInline() {
    for (const property of ["left", "top", "right", "bottom"]) host.style.removeProperty(property)
  }

  /**
   * @param {MouseEvent} event
   */
  function onClick(event) {
    if (!swallowClick) return
    swallowClick = false
    event.stopPropagation()
    event.preventDefault()
  }

  function destroy() {
    cancel()
    settle()
    handle.removeEventListener("pointerdown", onDown)
    host.removeEventListener("click", onClick, true)
    window.removeEventListener("blur", cancel)
  }
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}