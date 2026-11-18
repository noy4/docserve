const DEFAULT_ROOTS = ["main", "article", ".container"]
const DEFAULT_EXCLUDED = "nav, aside, header, footer"

/**
 * @typedef {{ element: HTMLHeadingElement, level: number, children: TocNode[] }} TocNode
 */

/**
 * Content root: `data-*` root selector, else the first of main / article / .container, else body.
 * @param {Document} [doc]
 * @param {string} [attribute]
 * @param {string[]} [selectors]
 * @returns {HTMLElement | null}
 */
export function findRoot(doc = document, attribute = "data-toc-root", selectors = DEFAULT_ROOTS) {
  const source = doc.body ?? doc.documentElement
  if (!source) return null

  const selector = source.getAttribute(attribute)
  if (selector) {
    try {
      const custom = doc.querySelector(selector)
      if (custom) return /** @type {HTMLElement} */ (custom)
    } catch {}
  }

  for (const candidate of selectors) {
    const element = doc.querySelector(candidate)
    if (element) return /** @type {HTMLElement} */ (element)
  }

  return doc.body
}

/**
 * Headings inside `root` whose level falls in `range`, in document order.
 * @param {HTMLElement | null} root
 * @param {[number, number] | null} range
 * @param {string} [excludedSelector]
 * @returns {HTMLHeadingElement[]}
 */
export function collectHeadings(root, range, excludedSelector = DEFAULT_EXCLUDED) {
  if (!root || !range) return []

  const [min, max] = range
  const headings = [...root.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter((element) => {
    const level = Number(element.tagName[1])
    if (level < min || level > max) return false
    if (!element.textContent?.trim()) return false
    if (isHidden(element)) return false

    const excluded = excludedSelector ? element.closest(excludedSelector) : null
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
