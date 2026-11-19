import { resolve } from "node:path"
import { docsInfo } from "../docs/info.mjs"

/**
 * @param {Array<{ docsDir: string, port: number, url: string }>} states
 * @param {string} currentDocsDir
 * @returns {DocServer[]}
 */
export function publicServers(states, currentDocsDir) {
  const current = resolve(currentDocsDir)
  return states
    .map((state) => ({
      ...docsInfo(state.docsDir),
      url: state.url,
      port: state.port,
      current: resolve(state.docsDir) === current,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name, "ja") || a.port - b.port)
}
