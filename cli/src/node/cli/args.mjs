export const DEFAULT_PORT = 4242

/**
 * @param {string | number | undefined} value
 * @returns {number}
 */
export function parsePort(value) {
  const port = Number(value ?? DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`[docserve] --port expects an integer between 1 and 65535, got "${value}"`)
  }
  return port
}
