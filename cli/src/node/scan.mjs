// Document discovery and the path guards every other node module shares.
import { realpathSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { isAbsolute, join, relative, sep } from "node:path"

// Walk docsDir recursively and collect .html files; only the root index.html is
// excluded from the gallery.
const MAX_DEPTH = 3

/**
 * @param {string} docsDir
 * @returns {Promise<string[]>} absolute paths
 */
export async function listHtmlFiles(docsDir) {
  /** @type {string[]} */
  const out = []
  await walk(docsDir, docsDir, 0)
  return out

  /**
   * @param {string} dir
   * @param {string} root
   * @param {number} depth
   */
  async function walk(dir, root, depth) {
    if (depth > MAX_DEPTH) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (shouldIgnore(entry.name)) continue
      if (entry.isDirectory()) {
        await walk(full, root, depth + 1)
      } else if (entry.name.endsWith(".html") && !(dir === root && entry.name === "index.html")) {
        out.push(full)
      }
    }
  }
}

/**
 * @param {string} base
 * @param {string} path
 * @returns {boolean}
 */
export function isWithin(base, path) {
  const rel = relative(base, path)
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/**
 * @param {string} base
 * @param {string} path
 * @returns {string}
 */
export function normalizedRelative(base, path) {
  return relative(base, path).split(sep).join("/")
}

/**
 * @param {string} relPath
 * @returns {boolean}
 */
export function shouldIgnore(relPath) {
  return relPath
    .split(/[/\\]/)
    .filter(Boolean)
    .some((part) => part.startsWith(".") || part === "node_modules")
}

// On macOS /var is a symlink to /private/var; canonicalize to real paths so
// lookups match git output.
/**
 * @param {string} p
 * @returns {string}
 */
export function realpath(p) {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}