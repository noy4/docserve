// Page listing for the widget: docserve:pages:list, cached until a change arrives.
import { decoded, pageUrl } from "./lib/dom.js"
import { callServer } from "./rpc-client.js"

/**
 * @param {{ rpc: RpcContext }} options
 */
export function createPages({ rpc }) {
  /** @type {DocPage[] | null} */
  let cache = null
  /** @type {Promise<DocPage[]> | null} */
  let pending = null

  rpc.register("docserve:pages:list", list)
  rpc.register("docserve:pages:resolve", resolve)

  return {
    list,
    resolve,
    /** Drop the cache so the next read refetches. */
    invalidate() {
      cache = null
      pending = null
    },
  }

  /**
   * @param {{ force?: boolean }} [options]
   * @returns {Promise<DocPage[]>}
   */
  async function list({ force = false } = {}) {
    if (force) {
      cache = null
      pending = null
    }
    if (cache) return cache
    if (pending) return pending

    pending = callServer("docserve:pages:list")
      .then((data) => {
        const pages = Array.isArray(data) ? data : []
        cache = pages
        return pages
      })
      .finally(() => {
        pending = null
      })

    return pending
  }

  /**
   * Find the page a docs-relative path points at.
   * @param {string} page  e.g. `guides/intro.html`
   * @returns {Promise<DocPage | null>}
   */
  async function resolve(page) {
    const target = pageUrl(page)
    const pages = await list()
    return pages.find((entry) => entry.url === target || decoded(entry.url) === `/${page}`) ?? null
  }
}