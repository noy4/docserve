// localStorage-backed values.

/**
 * @template T
 * @typedef {object} Persisted
 * @property {T} value
 * @property {() => void} clear
 */

/**
 * @template T
 * @param {string} key
 * @param {T} [initial]  Returned when the key is absent or cannot be parsed.
 * @param {object} [options]
 * @param {(raw: string) => T} [options.parse]
 * @param {(value: T) => string} [options.serialize]
 * @returns {Persisted<T>}
 */
export function persisted(key, initial = /** @type {any} */ (null), options = {}) {
  const {
    parse = (raw) => /** @type {any} */(raw),
    serialize = (value) => String(value),
  } = options

  function read() {
    try {
      const raw = localStorage.getItem(key)
      return raw == null ? initial : parse(raw)
    } catch {
      return initial
    }
  }

  function write(value) {
    try {
      localStorage.setItem(key, serialize(value))
    } catch { }
  }

  return {
    get value() {
      return read()
    },
    set value(next) {
      write(next)
    },
    clear() {
      try {
        localStorage.removeItem(key)
      } catch { }
    },
  }
}

/**
 * Boolean variant: stores `"true"` / `"false"`.
 * @param {string} key
 * @param {boolean} [initial]
 * @returns {Persisted<boolean>}
 */
export function persistedFlag(key, initial = false) {
  return persisted(key, initial, {
    parse: (raw) => raw === "true",
    serialize: (value) => String(value),
  })
}
