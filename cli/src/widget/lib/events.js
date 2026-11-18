// Generic event emitter, ported from devframe's `utils/events.ts`.

/**
 * @template {EventsMap} [Events=EventsMap]
 * @returns {EventEmitter<Events>}
 */
export function createEventEmitter() {
  /** @type {EventEmitter<Events>['_listeners']} */
  const _listeners = {}

  /**
   * @param {keyof Events} event
   * @param {...any} args
   */
  function emit(event, ...args) {
    const callbacks = _listeners[event] || []
    for (let i = 0, length = callbacks.length; i < length; i++) {
      const callback = callbacks[i]
      if (callback)
        callback(...args)
    }
  }

  /**
   * @param {keyof Events} event
   * @param {...any} args
   */
  function emitOnce(event, ...args) {
    emit(event, ...args)
    delete _listeners[event]
  }

  /**
   * @param {keyof Events} event
   * @param {(...args: any[]) => void} cb
   * @returns {EventUnsubscribe}
   */
  function on(event, cb) {
    ;(_listeners[event] ||= []).push(/** @type {Events[keyof Events]} */ (cb))
    return () => {
      _listeners[event] = /** @type {any} */ (_listeners[event]?.filter(i => cb !== i))
    }
  }

  /**
   * @param {keyof Events} event
   * @param {(...args: any[]) => void} cb
   * @returns {EventUnsubscribe}
   */
  function once(event, cb) {
    const unsubscribe = on(event, (...args) => {
      unsubscribe()
      return cb(...args)
    })
    return unsubscribe
  }

  return {
    _listeners,
    emit,
    emitOnce,
    on,
    once,
  }
}
