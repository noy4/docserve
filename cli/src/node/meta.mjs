// Title, created_at and favicon extracted from the head of a document, cached
// by path + mtime so repeated docserve:pages:list calls only re-read changed files.
import { open } from "node:fs/promises"
import { dirname, join } from "node:path"
import { isWithin, normalizedRelative } from "./scan.mjs"

/** @typedef {{ title: string | null, date: number | null, favicon: string | null }} DocMeta */

/** @type {Map<string, DocMeta>} */
const metaCache = new Map() // "path:mtimeMs" -> DocMeta

/**
 * @param {string} full
 * @param {number} mtimeMs
 * @param {string} docsDir
 * @returns {Promise<DocMeta>}
 */
export async function metaOf(full, mtimeMs, docsDir) {
  const key = `${full}:${mtimeMs}`
  const cached = metaCache.get(key)
  if (cached !== undefined) return cached
  const meta = await extractMeta(full, docsDir)
  metaCache.set(key, meta)
  return meta
}

/**
 * @param {string} full
 * @param {string} docsDir
 * @returns {Promise<DocMeta>}
 */
async function extractMeta(full, docsDir) {
  /** @param {string} text */
  const findTitle = (text) => {
    const raw = text.match(/<title>([^<]*)<\/title>/)?.[1]?.trim()
    return raw == null ? null : decodeEntities(raw)
  }
  /** @param {string} text */
  const findDate = (text) => {
    for (const tag of text.match(/<meta\b[^>]*>/gi) ?? []) {
      if (!/\bname\s*=\s*["']created_at["']/i.test(tag)) continue
      const d = new Date(tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() ?? "")
      if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000)
    }
    return null
  }
  // Attribute value from a tag string ("v", 'v', or bare); null when absent.
  /**
   * @param {string} tag
   * @param {string} name
   */
  const attrOf = (tag, name) => {
    const m = tag.match(new RegExp(`(?<![\\w-])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))
    return m?.[1] ?? m?.[2] ?? m?.[3] ?? null
  }
  // First <link rel="...icon..."> href resolved to a URL served from docsDir;
  // data: and absolute http(s) URLs are kept as-is.
  /** @param {string} text */
  const findFavicon = (text) => {
    // Quoted values may contain ">" (inline SVG data URIs), so scan links
    // value-aware instead of with a plain [^>]* tag match.
    for (const tag of text.match(/<link\b(?:"[^"]*"|'[^']*'|[^>])*>/gi) ?? []) {
      const rel = attrOf(tag, "rel")
      if (!rel || !/\bicon\b/i.test(rel)) continue
      const href = attrOf(tag, "href")?.trim()
      if (!href) continue
      if (/^data:/i.test(href)) return href.replaceAll("#", "%23")
      if (/^(https?:|\/\/)/i.test(href)) return href
      const target = href.startsWith("/")
        ? join(docsDir, href.split(/[?#]/)[0])
        : join(dirname(full), href.split(/[?#]/)[0])
      if (!isWithin(docsDir, target)) return null
      return `/${normalizedRelative(docsDir, target)}`
    }
    return null
  }
  try {
    const handle = await open(full, "r")
    try {
      /**
       * @param {number} len
       * @param {number} pos
       */
      const read = async (len, pos) => {
        const { buffer, bytesRead } = await handle.read(Buffer.alloc(len), 0, len, pos)
        return buffer.toString("utf8", 0, bytesRead)
      }
      // Titles and meta tags live in <head>; read only the first 4 KB.
      const head = await read(4096, 0)
      /** @type {DocMeta} */
      let meta = {
        title: findTitle(head),
        date: findDate(head),
        favicon: findFavicon(head),
      }
      if (meta.title === null || meta.date === null || meta.favicon === null) {
        // Fallback for documents with a long preamble (inline favicon etc.)
        const text = await read(1 << 20, 0)
        meta = {
          title: meta.title ?? findTitle(text),
          date: meta.date ?? findDate(text),
          favicon: meta.favicon ?? findFavicon(text),
        }
      }
      return meta
    } finally {
      await handle.close()
    }
  } catch {
    return { title: null, date: null, favicon: null }
  }
}

// Decode <title> entities so cards read "A & B", not "A &amp; B".
const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
}

/**
 * @param {string} s
 * @returns {string}
 */
function decodeEntities(s) {
  return s.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, ref) => {
    if (ref[0] === "#") {
      const hex = /[xX]/.test(ref[1])
      const cp = parseInt(hex ? ref.slice(2) : ref.slice(1), hex ? 16 : 10)
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m
    }
    return ENTITIES[ref.toLowerCase()] ?? m
  })
}