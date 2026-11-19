// Created/modified dates from git history, keyed by absolute path.
import { execFile } from "node:child_process"
import { join } from "node:path"
import { promisify } from "node:util"
import { realpath } from "./scan.mjs"

const run = promisify(execFile)

/** @typedef {{ created: Map<string, number>, modified: Map<string, number> }} DateMaps */

/** @type {Map<string, DateMaps>} */
const gitMapsCache = new Map() // repo root (or docsDir when not a repo) -> DateMaps

/**
 * A single full-repo scan with cwd set to the docs dir, cached per repo root in
 * module scope. git log outputs newest first: overwriting keeps the oldest add
 * (= creation date) and the newest touch (= modified date).
 * @param {string} docsDir
 * @returns {Promise<DateMaps>}
 */
export async function gitDateMaps(docsDir) {
  const cwd = realpath(docsDir)
  const top = (await git(["rev-parse", "--show-toplevel"], cwd)).trim()
  const root = top ? realpath(top) : null
  const cacheKey = root ?? cwd
  let maps = gitMapsCache.get(cacheKey)
  if (maps) return maps

  maps = { created: new Map(), modified: new Map() }
  if (root) {
    try {
      const [first, last] = await Promise.all([
        git(["log", "--diff-filter=A", "--name-only", "--format=c:%at"], cwd),
        git(["log", "--name-only", "--format=m:%at"], cwd),
      ])
      /** @type {number | undefined} */
      let ts
      for (const line of first.split("\n")) {
        if (line.startsWith("c:")) {
          ts = parseInt(line.slice(2), 10)
        } else if (line && ts !== undefined) {
          maps.created.set(join(root, line), ts) // oldest add wins
        }
      }
      ts = undefined
      for (const line of last.split("\n")) {
        if (line.startsWith("m:")) {
          ts = parseInt(line.slice(2), 10)
        } else if (line && ts !== undefined) {
          maps.modified.set(join(root, line), ts) // newest touch wins
        }
      }
    } catch {
      // unreadable history → fall back to fs dates
    }
  }
  gitMapsCache.set(cacheKey, maps)
  return maps
}

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<string>}
 */
async function git(args, cwd) {
  try {
    const { stdout } = await run("git", args, { cwd, timeout: 10000, maxBuffer: 64 * 1024 * 1024 })
    return stdout
  } catch {
    return ""
  }
}