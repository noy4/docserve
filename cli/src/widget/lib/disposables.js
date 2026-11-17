// Collect teardown callbacks so a setup can close everything in one place.

/**
 * @typedef {object} Disposables
 * @property {(dispose: () => void) => void} add  Run immediately when already disposed.
 * @property {() => void} dispose  Idempotent; newest callback first.
 */

/**
 * @returns {Disposables}
 */
export function createDisposables() {
  /** @type {(() => void)[]} */
  const callbacks = []
  let done = false

  return {
    add(dispose) {
      if (typeof dispose !== "function") throw new TypeError("disposables.add expects a function")
      if (done) {
        safeRun(dispose)
        return
      }
      callbacks.push(dispose)
    },
    dispose() {
      if (done) return
      done = true
      for (let i = callbacks.length - 1; i >= 0; i--) safeRun(callbacks[i])
      callbacks.length = 0
    },
  }
}

/**
 * @param {() => void} dispose
 */
function safeRun(dispose) {
  try {
    dispose()
  } catch (err) {
    console.error(err)
  }
}
