// Identity of the served folder, shared by the gallery template and the
// injected widget: display name, ~-collapsed path, deterministic hue.
import os from "node:os"
import { basename } from "node:path"

/** @typedef {{ name: string, path: string, hue: number }} DocsInfo */

/**
 * @param {string} docsDir
 * @returns {DocsInfo}
 */
export function docsInfo(docsDir) {
  return {
    name: basename(docsDir) || docsDir,
    path: displayPath(docsDir),
    hue: faviconHue(docsDir),
  }
}

// Collapse the home directory prefix to ~ for display.
/**
 * @param {string} p
 * @returns {string}
 */
function displayPath(p) {
  const home = os.homedir()
  return p.startsWith(`${home}/`) ? `~${p.slice(home.length)}` : p
}

// Deterministic hue for the folder favicon: the same path always yields the same color.
/**
 * @param {string} s
 * @returns {number}
 */
function faviconHue(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return ((h % 360) + 360) % 360
}
