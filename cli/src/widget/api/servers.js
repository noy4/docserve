import { callServer } from "./rpc-client.js"

/**
 * @param {{ rpc: RpcContext }} options
 */
export function createServers({ rpc }) {
  /** @type {DocServer[] | null} */
  let cache = null
  /** @type {Promise<DocServer[]> | null} */
  let pending = null

  rpc.register("docserve:servers:list", list)

  return {
    list,
    invalidate() {
      cache = null
      pending = null
    },
  }

  /**
   * @param {{ force?: boolean }} [options]
   * @returns {Promise<DocServer[]>}
   */
  async function list({ force = false } = {}) {
    if (force) {
      cache = null
      pending = null
    }
    if (cache) return cache
    if (pending) return pending

    pending = callServer("docserve:servers:list", force ? [true] : [])
      .then((data) => {
        const servers = Array.isArray(data) ? data : []
        cache = servers
        return servers
      })
      .finally(() => {
        pending = null
      })

    return pending
  }
}
