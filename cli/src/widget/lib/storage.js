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
 * @param {object} [options]
 * @param {T} [options.fallback]     Returned when the key is absent or storage fails.
 * @param {(raw: string) => T} [options.parse]
 * @param {(value: T) => string} [options.serialize]
 * @returns {Persisted<T>}
 */
export function persisted(key, options = {}) {
  const { fallback = /** @type {any} */ (null), parse = (raw) => /** @type {any} */ (raw), serialize = (value) => String(value) } = options

  function read() {
    try {
      const raw = localStorage.getItem(key)
      return raw == null ? fallback : parse(raw)
    } catch {
      return fallback
    }
  }

  function write(value) {
    try {
      localStorage.setItem(key, serialize(value))
    } catch {}
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
      } catch {}
    },
  }
}

/**
 * Boolean variant: stores `"true"` / `"false"`.
 * @param {string} key
 * @param {boolean} [fallback]
 * @returns {Persisted<boolean>}
 */
export function persistedFlag(key, fallback = false) {
  return persisted(key, {
    fallback,
    parse: (raw) => raw === "true",
    serialize: (value) => String(value),
  })
}