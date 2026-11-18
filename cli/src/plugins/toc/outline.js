const DEFAULT_RANGE = [2, 3]
const EXCLUDED = "nav, aside, header, footer, [data-toc-ignore]"
const ROOT_SELECTORS = ["main", "article", ".container"]

/**
 * @typedef {{ element: HTMLHeadingElement, level: number, children: TocNode[] }} TocNode
 * @typedef {{ root: HTMLElement | null, range: [number, number] | null, headings: HTMLHeadingElement[] }} TocOutline
 */

/**
 * `data-toc-outline` → `[min, max] | "deep" | false`.
 * @param {string | null | undefined} value
 * @returns {number | number[] | "deep" | false}
 */
export function parseOutline(value) {
  if (value == null || value.trim() === "") return [...DEFAULT_RANGE]
  if (value === "deep") return "deep"
  if (value === "false") return false

  const levels = value.split(",").map((part) => Number(part.trim())).filter(Number.isFinite)
  if (!levels.length) return [...DEFAULT_RANGE]
  return levels.length > 1 ? levels : levels[0]
}

/**
 * Normalize an outline setting to an inclusive heading-level range.
 * @param {number | number[] | "deep" | false | { level?: number | number[] | "deep" } | null | undefined} outline
 * @returns {[number, number] | null}
 */
export function resolveRange(outline) {
  if (outline === false) return null

  const value = (outline && typeof outline === "object" && !Array.isArray(outline) ? outline.level : outline) ?? DEFAULT_RANGE

  if (Array.isArray(value)) {
    const min = Number(value[0])
    const max = Number(value[1])
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [2, 3]
    return min <= max ? [min, max] : [max, min]
  }

  if (value === "deep") return [2, 6]

  const level = Number(value)
  return Number.isFinite(level) ? [level, level] : [2, 3]
}

/**
 * Content root: `data-toc-root`, else the first of main / article / .container, else body.
 * @param {Document} [doc]
 * @returns {HTMLElement | null}
 */
export function findRoot(doc = document) {
  const source = doc.body ?? doc.documentElement
  if (!source) return null

  const selector = source.getAttribute("data-toc-root")
  if (selector) {
    try {
      const custom = doc.querySelector(selector)
      if (custom) return /** @type {HTMLElement} */ (custom)
    } catch {}
  }

  for (const candidate of ROOT_SELECTORS) {
    const element = doc.querySelector(candidate)
    if (element) return /** @type {HTMLElement} */ (element)
  }

  return doc.body
}

/**
 * Headings inside `root` whose level falls in `range`, in document order.
 * @param {HTMLElement | null} root
 * @param {[number, number] | null} range
 * @returns {HTMLHeadingElement[]}
 */
export function collectHeadings(root, range) {
  if (!root || !range) return []

  const [min, max] = range
  const headings = [...root.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter((element) => {
    const level = Number(element.tagName[1])
    if (level < min || level > max) return false
    if (!element.textContent?.trim()) return false
    if (isHidden(element)) return false

    const excluded = element.closest(EXCLUDED)
    return !excluded || excluded === root || !root.contains(excluded)
  })

  return /** @type {HTMLHeadingElement[]} */ (headings)
}

/**
 * Give every heading a stable, unique id; existing ids are kept.
 * @param {HTMLHeadingElement[]} headings
 * @param {Document} [doc]
 */
export function ensureIds(headings, doc = document) {
  const reserved = new Set()
  for (const element of doc.querySelectorAll("[id]")) {
    if (element.id) reserved.add(element.id)
  }

  for (const heading of headings) {
    if (heading.id) continue

    const base = slugify(heading.textContent ?? "")
    let id = base
    let index = 2
    while (!id || reserved.has(id)) id = base ? `${base}-${index++}` : `section-${index++}`

    heading.id = id
    reserved.add(id)
  }
}

/**
 * `Hello, World!` → `hello-world`.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

/**
 * Nest headings by level: a heading becomes a child while its level is greater
 * than the previous one.
 * @param {HTMLHeadingElement[]} headings
 * @returns {TocNode[]}
 */
export function buildTree(headings) {
  /** @type {TocNode[]} */
  const roots = []
  /** @type {TocNode[]} */
  const stack = []

  for (const element of headings) {
    const node = { element, level: Number(element.tagName[1]), children: [] }
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop()
    if (stack.length) stack[stack.length - 1].children.push(node)
    else roots.push(node)
    stack.push(node)
  }

  return roots
}

/**
 * Resolve the page root, its outline range and its headings.
 * @param {Document} [doc]
 * @returns {TocOutline}
 */
export function collectOutline(doc = document) {
  const root = findRoot(doc)
  const source = doc.body ?? doc.documentElement
  if (!root || !source) return { root: null, range: null, headings: [] }

  const raw = root.getAttribute("data-toc-outline") ?? source.getAttribute("data-toc-outline")
  const range = resolveRange(parseOutline(raw))
  if (!range) return { root, range: null, headings: [] }

  const headings = collectHeadings(root, range)
  ensureIds(headings, doc)

  return { root, range, headings }
}

/**
 * @param {Element} element
 * @returns {boolean}
 */
function isHidden(element) {
  if (element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true") return true
  if (element.closest("details:not([open])")) return true

  const view = element.ownerDocument.defaultView
  if (!view) return false

  for (let node = element; node; node = node.parentElement) {
    const style = view.getComputedStyle(node)
    if (style.display === "none" || style.visibility === "hidden") return true
  }

  return false
}
