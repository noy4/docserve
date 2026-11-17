// Generic event bus. The type shape follows nanoevents; the storage is a Map of
// Sets so duplicate handlers collapse and handlers may unsubscribe mid-emit.

/**
 * @template {Record<string, (...args: any[]) => void>} [Events=Record<string, (...args: any[]) => void>]
 * @returns {Emitter<Events>}
 */
export function createEmitter() {
  /** @type {Map<string, Set<(...args: any[]) => void>>} */
  const listeners = new Map()

  return { on, emit }

  /**
   * @param {string} type
   * @param {(...args: any[]) => void} handler
   * @returns {() => void}
   */
  function on(type, handler) {
    const handlers = listeners.get(type) ?? new Set()
    handlers.add(handler)
    listeners.set(type, handlers)
    return () => {
      handlers.delete(handler)
      if (!handlers.size) listeners.delete(type)
    }
  }

  /**
   * @param {string} type
   * @param {...any} args
   */
  function emit(type, ...args) {
    for (const handler of listeners.get(type) ?? []) {
      try {
        handler(...args)
      } catch (error) {
        console.error(`[docserve] ${type} handler failed`, error)
      }
    }
  }
}