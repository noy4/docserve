import {
  buildTree,
  collectHeadings as collect,
  ensureIds,
  findRoot as find,
  slugify,
} from "../../widget/lib/headings.js"

export { buildTree, ensureIds, slugify }

const DEFAULT_RANGE = [2, 3]
const EXCLUDED = "nav, aside, header, footer, [data-toc-ignore]"
const ROOT_ATTRIBUTE = "data-toc-root"

/**
 * @typedef {{ root: HTMLElement | null, range: [number, number] | null, headings: HTMLHeadingElement[] }} TocOutline
 */

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
 * Content root for the TOC.
 * @param {Document} [doc]
 * @returns {HTMLElement | null}
 */
export function findRoot(doc = document) {
  return find(doc, ROOT_ATTRIBUTE)
}

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
 * Headings inside `root` whose level falls in `range`, in document order.
 * @param {HTMLElement | null} root
 * @param {[number, number] | null} range
 * @returns {HTMLHeadingElement[]}
 */
export function collectHeadings(root, range) {
  return collect(root, range, EXCLUDED)
}
