import { effect, signal } from "@preact/signals-react"
import { useEffect } from "react"
import { ICON_CHECK, ICON_CHEVRON_DOWN } from "../icons.js"
import { useModel } from "./useModel.js"

export interface RadioMenuOption<T extends string> {
  id: T
  label: string
  icon: string
}

export interface RadioMenuProps<T extends string> {
  /** Accessible name for the menu and its trigger, e.g. "Grouping". */
  label: string
  value: T
  options: readonly RadioMenuOption<T>[]
  onChange: (value: T) => void
}

/** Open state, placement and event handling for a single-choice menu. */
export class RadioMenuModel {
  readonly open = signal(false)
  readonly position = signal<{ top: number; right: number } | null>(null)

  #trigger: HTMLButtonElement | null = null
  #menu: HTMLDivElement | null = null
  #items: (HTMLButtonElement | null)[] = []

  readonly setTrigger = (element: HTMLButtonElement | null): void => {
    this.#trigger = element
  }

  readonly setMenu = (element: HTMLDivElement | null): void => {
    this.#menu = element
  }

  readonly setItem = (index: number, element: HTMLButtonElement | null): void => {
    this.#items[index] = element
  }

  /** Document-level dismiss listeners live only while the menu is open. */
  subscribe(): () => void {
    return effect(() => {
      if (!this.open.value) return

      document.addEventListener("pointerdown", this.#onPointerDown, true)
      document.addEventListener("keydown", this.#onKeyDown, true)
      window.addEventListener("resize", this.#onDismiss)
      window.addEventListener("scroll", this.#onDismiss, true)

      return () => {
        document.removeEventListener("pointerdown", this.#onPointerDown, true)
        document.removeEventListener("keydown", this.#onKeyDown, true)
        window.removeEventListener("resize", this.#onDismiss)
        window.removeEventListener("scroll", this.#onDismiss, true)
      }
    })
  }

  readonly toggle = (): void => {
    if (this.open.value) {
      this.close({ focusTrigger: false })
      return
    }

    const rect = this.#trigger?.getBoundingClientRect()
    if (!rect) return
    // Fixed placement: the panel clips positioned descendants.
    this.position.value = { top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) }
    this.open.value = true
  }

  close({ focusTrigger = true }: { focusTrigger?: boolean } = {}): void {
    this.open.value = false
    this.position.value = null
    if (focusTrigger) this.#trigger?.focus()
  }

  select<T extends string>(id: T, onChange: (id: T) => void): void {
    onChange(id)
    this.close()
  }

  focusIndex(index: number): void {
    this.#items[index]?.focus()
  }

  #moveFocus(key: string): void {
    const items = this.#items.filter((item): item is HTMLButtonElement => item !== null)
    if (!items.length) return

    const index = items.indexOf(this.#activeItem())
    const last = items.length - 1
    let next = index

    if (key === "Home") next = 0
    else if (key === "End") next = last
    else if (key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % items.length
    else next = index < 0 ? last : (index - 1 + items.length) % items.length

    items[next]?.focus()
  }

  /** Focused element inside any shadow root that wraps the widget. */
  #activeItem(): HTMLButtonElement | null {
    let active: Element | null = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    return active instanceof HTMLButtonElement ? active : null
  }

  #onPointerDown = (event: PointerEvent): void => {
    const path = event.composedPath()
    if (this.#menu && path.includes(this.#menu)) return
    if (this.#trigger && path.includes(this.#trigger)) return
    this.close({ focusTrigger: false })
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      // Keep the shortcut from also closing the sidebar.
      event.stopPropagation()
      this.close()
      return
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End")
      return

    event.preventDefault()
    this.#moveFocus(event.key)
  }

  #onDismiss = (): void => this.close({ focusTrigger: false })
}

export function RadioMenu<T extends string>({ label, value, options, onChange }: RadioMenuProps<T>) {
  const menu = useModel(() => new RadioMenuModel())
  const open = menu.open.value
  const position = menu.position.value
  const current = options.find((option) => option.id === value) ?? options[0]

  // Focusing needs the rendered menu, so it runs after React commits.
  useEffect(() => {
    if (open)
      menu.focusIndex(Math.max(0, options.findIndex((option) => option.id === value)))
  }, [menu, open, value, options])

  if (!current) return null

  return (
    <>
      <button
        ref={menu.setTrigger}
        type="button"
        className="docserve-sidebar__menu-trigger"
        aria-label={`${label}: ${current.label}`}
        title={`${label}: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={menu.toggle}
      >
        <span className="docserve-sidebar__menu-trigger-icon" dangerouslySetInnerHTML={{ __html: current.icon }} />
        <span className="docserve-sidebar__menu-trigger-caret" dangerouslySetInnerHTML={{ __html: ICON_CHEVRON_DOWN }} />
      </button>
      {open && position && (
        <div
          ref={menu.setMenu}
          className="docserve-sidebar__menu"
          role="menu"
          aria-label={label}
          style={{ top: `${position.top}px`, right: `${position.right}px` }}
        >
          <div className="docserve-sidebar__menu-label" role="presentation">{label}</div>
          {options.map((option, index) => {
            const checked = option.id === value

            return (
              <button
                key={option.id}
                ref={(element) => menu.setItem(index, element)}
                type="button"
                className="docserve-sidebar__menu-item"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => menu.select(option.id, onChange)}
              >
                <span className="docserve-sidebar__menu-item-icon" dangerouslySetInnerHTML={{ __html: option.icon }} />
                <span className="docserve-sidebar__menu-item-label">{option.label}</span>
                <span
                  className="docserve-sidebar__menu-item-check"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: checked ? ICON_CHECK : "" }}
                />
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}