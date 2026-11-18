// Command palette overlay: filter, arrow keys and selection. It owns no
// state — both the open flag and the registry live in `commands.js`.
import { formatKey } from "./commands.js"
import { el } from "./lib/dom.js"

/**
 * @param {object} options
 * @param {ShadowRoot} options.root   Where the overlay is mounted.
 * @param {UiContext} options.ui
 * @param {CommandsContext} options.commands
 * @param {(listener: () => void) => () => void} options.subscribe
 * @returns {{ open: () => void, close: () => void, destroy: () => void }}
 */
export function createPalette({ root, ui, commands, subscribe }) {
  const input = /** @type {HTMLInputElement} */ (el("input", {
    class: "docserve-palette__input",
    type: "text",
    role: "combobox",
    "aria-expanded": "true",
    "aria-controls": "docserve-palette-list",
    "aria-autocomplete": "list",
    placeholder: "Type a command…",
    autocomplete: "off",
    spellcheck: "false",
  }))
  const list = el("ul", { class: "docserve-palette__list", id: "docserve-palette-list", role: "listbox" })
  const empty = el("p", { class: "docserve-palette__empty", text: "No matching commands" })
  const dialog = el("div", { class: "docserve-palette__dialog", role: "dialog", "aria-modal": "true", "aria-label": "Commands" }, [
    input,
    list,
    empty,
    el("footer", { class: "docserve-palette__footer" }, [
      hint("↑↓", "select"),
      hint("↵", "run"),
      hint("esc", "close"),
    ]),
  ])
  const backdrop = el("div", { class: "docserve-palette__backdrop" })
  const overlay = el("div", { class: "docserve-palette" }, [backdrop, dialog])

  root.append(overlay)
  ui.style("/__docserve/widget/palette.css")

  /** @type {DocserveCommand[]} */
  let items = []
  let index = 0
  let shown = false
  /** @type {Element | null} */
  let previous = null

  input.addEventListener("input", filter)
  input.addEventListener("keydown", onKeydown)
  backdrop.addEventListener("click", close)
  list.addEventListener("click", (event) => {
    const row = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest("[data-command]"))
    if (row?.dataset.command) activate(row.dataset.command)
  })

  const off = subscribe(sync)

  return { destroy, open: openPalette, close }

  function openPalette() {
    commands.palette.open()
  }

  function close() {
    commands.palette.close()
  }

  // Rebuild on any registry change and follow the open flag.
  function sync() {
    const open = commands.palette.isOpen()
    if (open === shown) {
      if (open) filter()
      return
    }
    shown = open
    overlay.toggleAttribute("data-open", open)
    document.documentElement.toggleAttribute("data-docserve-palette", open)

    if (open) {
      previous = document.activeElement
      input.value = ""
      filter()
      requestAnimationFrame(() => input.focus())
    } else {
      input.value = ""
      restoreFocus()
      previous = null
    }
  }

  function restoreFocus() {
    if (!(previous instanceof HTMLElement) || !document.contains(previous)) return
    try {
      previous.focus()
    } catch {}
  }

  function filter() {
    const query = input.value.trim().toLowerCase()
    items = commands
      .list()
      .filter((command) => command.showInPalette !== false)
      .map((command) => ({ command, score: score(command, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.command)

    index = 0
    render()
  }

  function render() {
    list.replaceChildren(...items.map(row))
    empty.toggleAttribute("data-visible", items.length === 0)
    mark()
  }

  /**
   * @param {DocserveCommand} command
   * @returns {HTMLElement}
   */
  function row(command) {
    const keys = command.keys ?? []
    const node = el("li", {
      class: "docserve-palette__row",
      role: "option",
      id: rowId(command.id),
      "data-command": command.id,
      "aria-selected": "false",
    }, [
      command.icon ? el("span", { class: "docserve-palette__icon", html: command.icon }) : null,
      el("span", { class: "docserve-palette__text" }, [
        el("span", { class: "docserve-palette__title", text: command.title }),
        command.description ? el("span", { class: "docserve-palette__hint", text: command.description }) : null,
      ]),
      keys.length
        ? el("span", { class: "docserve-palette__keys" }, keys.map((key) => el("kbd", { class: "docserve-palette__key", text: formatKey(key) })))
        : null,
    ])
    node.addEventListener("pointermove", () => {
      index = items.indexOf(command)
      mark()
    })
    return node
  }

  function mark() {
    const rows = list.children
    for (let i = 0; i < rows.length; i++) rows[i].setAttribute("aria-selected", String(i === index))
    input.setAttribute("aria-activedescendant", items[index] ? rowId(items[index].id) : "")
    if (items[index]) select(items[index])
  }

  /**
   * @param {DocserveCommand} command
   */
  function select(command) {
    const node = list.querySelector(`#${CSS.escape(rowId(command.id))}`)
    node?.scrollIntoView({ block: "nearest" })
  }

  /**
   * @param {KeyboardEvent} event
   */
  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      const command = items[index]
      if (command) activate(command.id)
      return
    }

    const step =
      event.key === "ArrowDown" ? 1
      : event.key === "ArrowUp" ? -1
      : event.key === "Home" ? -items.length
      : event.key === "End" ? items.length
      : 0
    if (!step || !items.length) return
    event.preventDefault()
    index = (index + step + items.length) % items.length
    mark()
  }

  /**
   * @param {string} id
   */
  function activate(id) {
    close()
    commands.run(id).catch((error) => console.error(`[docserve] command failed: ${id}`, error))
  }

  function destroy() {
    off()
    overlay.remove()
    document.documentElement.removeAttribute("data-docserve-palette")
  }
}

/**
 * Rank a command against the query: title prefix beats word prefix beats
 * substring beats a hint/group match beats a scattered subsequence.
 * @param {DocserveCommand} command
 * @param {string} query
 * @returns {number}
 */
function score(command, query) {
  if (!query) return 1
  const title = command.title.toLowerCase()
  if (title.startsWith(query)) return 100
  if (title.split(/[\s:/_-]+/).some((word) => word.startsWith(query))) return 80
  if (title.includes(query)) return 60
  if (`${command.description ?? ""} ${command.category ?? ""}`.toLowerCase().includes(query)) return 40
  return subsequence(query, title) ? 20 : 0
}

/**
 * @param {string} needle
 * @param {string} haystack
 * @returns {boolean}
 */
function subsequence(needle, haystack) {
  let at = 0
  for (const char of needle) {
    at = haystack.indexOf(char, at)
    if (at === -1) return false
    at += 1
  }
  return true
}

/**
 * @param {string} id
 * @returns {string}
 */
function rowId(id) {
  return `docserve-cmd-${id.replace(/[^\w-]/g, "_")}`
}

/**
 * @param {string} key
 * @param {string} label
 * @returns {HTMLElement}
 */
function hint(key, label) {
  return el("span", { class: "docserve-palette__legend" }, [
    el("kbd", { text: key }),
    el("span", { text: label }),
  ])
}