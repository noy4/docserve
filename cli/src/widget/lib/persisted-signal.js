// Signal backed by localStorage: read once on creation, written on change.
import { signal } from "@preact/signals-react"
import { persisted as persistedStore } from "./storage.js"

/**
 * @template T
 * @param {string} key
 * @param {T} [initial]  Used when the key is absent or cannot be parsed.
 * @param {object} [options]
 * @param {(raw: string) => T} [options.parse]
 * @param {(value: T) => string} [options.serialize]
 * @returns {import("@preact/signals-react").Signal<T>}
 */
export function persisted(key, initial, options = {}) {
  const store = persistedStore(key, initial, options)
  const value = signal(store.value)

  // `subscribe` runs once immediately; skip that write so construction alone
  // does not create the key.
  let first = true
  value.subscribe((next) => {
    if (first) {
      first = false
      return
    }
    store.value = next
  })

  return value
}

/**
 * Boolean variant of `persisted`.
 * @param {string} key
 * @param {boolean} [initial]
 * @returns {import("@preact/signals-react").Signal<boolean>}
 */
export function persistedBool(key, initial = false) {
  return persisted(key, initial, { parse: (raw) => raw === "true" })
}
