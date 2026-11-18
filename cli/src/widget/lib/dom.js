// DOM helpers

/**
 * Create an element. `class`, `text`, `html` and object `style` are special;
 * `on*` keys attach listeners; anything else becomes an attribute.
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {Node | string | null | false | (Node | string | null | false)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue
    if (key === "class") node.className = value
    else if (key === "text") node.textContent = value
    else if (key === "html") node.innerHTML = value
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value)
    else if (key.startsWith("on") && typeof value === "function")
      node.addEventListener(key.slice(2).toLowerCase(), value)
    else node.setAttribute(key, value === true ? "" : String(value))
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null || child === false) continue
    node.append(child)
  }
  return /** @type {HTMLElement} */ (node)
}

/**
 * Mark inline SVG as decorative and optionally add a class.
 * @param {string} svg  `<svg …>…</svg>` markup.
 * @param {string} [name]
 * @returns {string}
 */
export function iconSvg(svg, name = "") {
  const cls = name ? ` class="${name}"` : ""
  return svg.replace("<svg ", `<svg aria-hidden="true"${cls} `)
}

/**
 * Unix seconds or a parseable date → `YYYY/MM/DD`, or `""` when invalid.
 * @param {number | string} value
 * @returns {string}
 */
export function displayDate(value) {
  const date = new Date(typeof value === "number" ? value * 1000 : value)
  if (Number.isNaN(date.getTime())) return ""
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}/${m}/${d}`
}

/**
 * Docs-relative path → root-absolute URL, encoding each segment.
 * @param {string} path  e.g. `guides/intro.html`
 * @returns {string}
 */
export function pageUrl(path) {
  return `/${path.split("/").map(encodeURIComponent).join("/")}`
}

/**
 * Decode a URL, falling back to the input when it is malformed.
 * @param {string} url
 * @returns {string}
 */
export function decoded(url) {
  try {
    return decodeURIComponent(url)
  } catch {
    return url
  }
}

/**
 * True when the event target takes text input, so shortcuts must stay out.
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
export function isTyping(target) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

/**
 * Copy text to the clipboard, falling back to a hidden textarea.
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = /** @type {HTMLTextAreaElement} */ (el("textarea", { readonly: "" }))
  area.style.position = "fixed"
  area.style.top = "-9999px"
  area.value = text
  document.body.append(area)
  area.select()
  const ok = document.execCommand("copy")
  area.remove()
  if (!ok) throw new Error("copy failed")
}