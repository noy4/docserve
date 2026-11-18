// Month buckets for the sidebar page list.

/**
 * @typedef {object} PageGroup
 * @property {string} key    Month `YYYY-MM`, or folder path with a trailing slash.
 * @property {string} label  Heading text, e.g. `2026/04`, `guides/` or `/`.
 * @property {DocPage[]} pages
 */

const NO_DATE = "No date"

/**
 * Local-time month key for a timestamp.
 * @param {number | string} value  Unix seconds, or a parseable date string.
 * @returns {string}
 */
export function monthKey(value) {
  const date = toDate(value)
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

/**
 * Heading text for a month key.
 * @param {string} key
 * @returns {string}
 */
export function monthLabel(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key)
  if (!match) return NO_DATE
  return `${match[1]}/${match[2]}`
}

/**
 * Partition pages into month groups, newest first. Order inside a group is
 * preserved; pages without a valid date go last.
 * @param {DocPage[]} pages
 * @returns {PageGroup[]}
 */
export function groupByMonth(pages) {
  /** @type {Map<string, PageGroup>} */
  const groups = new Map()

  for (const page of pages) {
    const key = monthKey(page.created)
    let group = groups.get(key)
    if (!group) {
      group = { key, label: key ? monthLabel(key) : NO_DATE, pages: [] }
      groups.set(key, group)
    }
    group.pages.push(page)
  }

  return [...groups.values()].sort((a, b) => {
    if (!a.key) return b.key ? 1 : 0
    if (!b.key) return -1
    return b.key.localeCompare(a.key)
  })
}

/**
 * @param {number | string} value
 * @returns {Date | null}
 */
function toDate(value) {
  const date = new Date(typeof value === "number" ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Folder that directly holds a page, with a trailing slash; `""` for the root.
 * @param {string} url  Root-absolute page URL, e.g. `/guides/intro.html`.
 * @returns {string}
 */
export function folderOf(url) {
  const parts = url.split("/").filter(Boolean)
  parts.pop()
  return parts.length ? `${parts.join("/")}/` : ""
}

/**
 * Group pages by the folder that directly holds them, root first. Folders
 * without pages of their own never appear, and groups do not nest.
 * @param {DocPage[]} pages
 * @returns {PageGroup[]}
 */
export function groupByFolder(pages) {
  /** @type {Map<string, PageGroup>} */
  const groups = new Map()

  for (const page of pages) {
    const key = folderOf(page.url)
    let group = groups.get(key)
    if (!group) {
      group = { key, label: key || "/", pages: [] }
      groups.set(key, group)
    }
    group.pages.push(page)
  }

  return [...groups.values()].sort((a, b) => {
    if (!a.key) return b.key ? -1 : 0
    if (!b.key) return 1
    return a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: "base" })
  })
}
