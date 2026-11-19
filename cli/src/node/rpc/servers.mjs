import { publicServers } from "../servers.mjs"
import { listLiveStates } from "../state.mjs"

export function registerServers(rpc, { docsDir, ttl = 1000 }) {
  let cached = null
  let cachedAt = 0

  rpc.register("docserve:servers:list", (force = false) => {
    const now = Date.now()
    if (force || !cached || now - cachedAt >= ttl) {
      cached = publicServers(listLiveStates(), docsDir)
      cachedAt = now
    }
    return cached
  })
}
