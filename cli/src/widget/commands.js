// Command registry, key matching and palette state. Every user action is
// registered once, then reached from a shortcut, the palette or a dock item.
import { isTyping } from "./lib/dom.js"

/** The palette's own command: the only one that fires while the palette is open. */
export const PALETTE_COMMAND = "docserve:palette"

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/**
 * @param {object} options
 * @param {() => DocserveContext} options.getContext  Resolved when a command runs.
 * @returns {{ api: CommandsContext, onChange: (listener: () => void) => () => void, destroy: () => void }}
 */
export function createCommands({ getContext }) {
  /** @type {Map<string, DocserveCommand>} */
  const commands = new Map()
  /** @type {Set<() => void>} */
  const listeners = new Set()
  let open = false

  window.addEventListener("keydown", onKeydown, { capture: true })

  const api = {
    register,
    run,
    list,
    palette: {
      open: openPalette,
      close: closePalette,
      toggle: togglePalette,
      isOpen: () => open,
    },
  }

  // The palette state and its exclusivity guard live here, so its toggle is
  // registered with them.
  register({
    id: PALETTE_COMMAND,
    title: "Command palette",
    keys: ["Mod+K"],
    showInPalette: false,
    run: () => api.palette.toggle(),
  })

  return { api, onChange, destroy }

  /**
   * @param {() => void} listener
   * @returns {() => void}
   */
  function onChange(listener) {
    if (!listener) return () => { }
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  /**
   * @param {DocserveCommand} command
   * @returns {() => void}
   */
  function register(command) {
    if (typeof command?.id !== "string" || !command.id) throw new TypeError("commands.register expects an id")
    if (typeof command.title !== "string" || !command.title)
      throw new TypeError(`command ${command.id} expects a title`)
    if (typeof command.run !== "function") throw new TypeError(`command ${command.id} expects run()`)
    if (commands.has(command.id)) throw new Error(`command already registered: ${command.id}`)

    commands.set(command.id, command)
    notify()
    return () => {
      if (commands.get(command.id) !== command) return
      commands.delete(command.id)
      notify()
    }
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function run(id) {
    const command = commands.get(id)
    if (!command) throw new Error(`unknown command: ${id}`)
    if (command.when && !command.when()) throw new Error(`command unavailable: ${id}`)
    await command.run(getContext())
  }

  /**
   * Commands that can run right now, in registration order.
   * @returns {DocserveCommand[]}
   */
  function list() {
    return [...commands.values()].filter((command) => !command.when || command.when())
  }

  function notify() {
    for (const listener of listeners) {
      try {
        listener()
      } catch (error) {
        console.error("[docserve] command listener failed", error)
      }
    }
  }

  function openPalette() {
    if (open) return
    open = true
    notify()
  }

  function closePalette() {
    if (!open) return
    open = false
    notify()
  }

  function togglePalette() {
    if (open) closePalette()
    else openPalette()
  }

  /**
   * @param {KeyboardEvent} event
   */
  function onKeydown(event) {
    if (event.defaultPrevented || event.isComposing) return

    // While the palette is up it owns every key except its own toggle.
    const pressed = normalizeKey(event)
    if (!pressed) return
    if (open && !sameKey(pressed, toggleKey())) return

    // A bare letter belongs to the page unless it is typing into a field.
    if (isTyping(event.target) && !pressed.includes("+")) return

    for (const command of list()) {
      if (!command.keys?.some((key) => sameKey(key, pressed))) continue
      event.preventDefault()
      event.stopPropagation()
      run(command.id).catch((error) => console.error(`[docserve] command failed: ${command.id}`, error))
      return
    }
  }

  function toggleKey() {
    const command = commands.get(PALETTE_COMMAND)
    return command?.keys?.[0] ?? ""
  }

  // Events report letters uppercased (`C`); bindings are written naturally (`c`).
  /**
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  function sameKey(a, b) {
    return a.toUpperCase() === b.toUpperCase()
  }

  function destroy() {
    window.removeEventListener("keydown", onKeydown, { capture: true })
    commands.clear()
    listeners.clear()
    open = false
  }
}

/**
 * Shortcut string for a keyboard event: `Mod+K`, `Alt+B`, `Shift+C`, `[`.
 * Letters come from `event.code`, so Option-modified keys on macOS (where
 * `event.key` becomes `∫`) still match their physical key.
 * @param {KeyboardEvent} event
 * @returns {string} empty for modifier-only presses
 */
export function normalizeKey(event) {
  /** @type {string[]} */
  const parts = []
  if (isMac ? event.metaKey : event.ctrlKey) parts.push("Mod")
  if (event.altKey) parts.push("Alt")
  if (event.shiftKey) parts.push("Shift")

  const key = mainKey(event)
  if (!key) return ""
  parts.push(key)
  return parts.join("+")
}

/**
 * @param {KeyboardEvent} event
 * @returns {string}
 */
function mainKey(event) {
  const key = event.key ?? ""
  if (key.length === 1 && /[ -~]/.test(key)) return /[a-z]/i.test(key) ? key.toUpperCase() : key

  const code = event.code ?? ""
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1]
  const digit = /^Digit([0-9])$/.exec(code)
  if (digit) return digit[1]

  return ["Control", "Meta", "Alt", "Shift", "Unidentified"].includes(key) ? "" : key
}

/** `Mod+K` → `⌘K` on macOS, `Ctrl+K` elsewhere. */
export function formatKey(key) {
  const names = isMac ? { Mod: "\u2318", Shift: "\u21e7", Alt: "\u2325" } : { Mod: "Ctrl+", Shift: "Shift+", Alt: "Alt+" }
  return key
    .split("+")
    .map((part) => /** @type {Record<string,string>} */(names)[part] ?? part)
    .join(isMac ? "" : "")
}