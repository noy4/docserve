// /api/files payload: page metadata composed from scanning, head parsing and
// git dates.
import { realpathSync } from "node:fs"
import { stat } from "node:fs/promises"
import { basename } from "node:path"
import { gitDateMaps } from "./dates.mjs"
import { metaOf } from "./meta.mjs"
import { listHtmlFiles, normalizedRelative } from "./scan.mjs"

/**
 * @param {string} docsDir
 */
export async function apiFiles(docsDir) {
  const paths = await listHtmlFiles(docsDir)
  const { created, modified } = await gitDateMaps(docsDir)
  const files = []
  for (const full of paths) {
    let st
    try {
      st = await stat(full)
    } catch {
      continue // deleted between listing and stat
    }
    const { title, date, favicon } = await metaOf(full, st.mtimeMs, docsDir)
    let key
    try {
      key = realpathSync(full)
    } catch {
      continue
    }
    const rel = normalizedRelative(docsDir, full)
    files.push({
      title: title ?? basename(full),
      url: `/${rel}`,
      filePath: full,
      favicon: favicon ?? undefined,
      created: date ?? created.get(key) ?? Math.floor(st.birthtimeMs / 1000),
      modified: modified.get(key) ?? Math.floor(st.mtimeMs / 1000),
    })
  }
  files.sort((a, b) => b.created - a.created || a.title.localeCompare(b.title, "ja") || a.url.localeCompare(b.url))
  return files
}