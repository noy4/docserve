export const DEFAULT_PORT = 4242

const SUBCOMMANDS = new Set(["stop", "status"])
const HELP_FLAGS = new Set(["-h", "--help", "-v", "--version"])

/**
 * @param {string[]} argv
 * @returns {string[]}
 */
export function normalizeArgv(argv) {
  const [node, bin, ...args] = argv

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--") break
    if (arg === "--port") {
      index += 1
      continue
    }
    if (arg.startsWith("--port=")) continue
    if (SUBCOMMANDS.has(arg) && index > 0) {
      args.splice(index, 1)
      args.unshift(arg)
      break
    }
  }

  let firstPositional = -1
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--") break
    if (arg === "--port") {
      index += 1
      continue
    }
    if (arg.startsWith("--port=") || arg.startsWith("-")) continue
    firstPositional = index
    break
  }

  const first = firstPositional >= 0 ? args[firstPositional] : undefined
  if (first && first !== "start" && !SUBCOMMANDS.has(first)) args.splice(firstPositional, 0, "start")
  else if (!first && !args.some((arg) => HELP_FLAGS.has(arg))) args.push("start")

  return [node, bin, ...args]
}

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
