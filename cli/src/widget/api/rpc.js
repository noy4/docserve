// In-page method bus. `docserve:` is reserved for core methods; plugins use
// `plugin:<id>:<method>`.

/**
 * @returns {RpcContext}
 */
export function createRpc() {
  /** @type {Map<string, (...args: any[]) => any>} */
  const methods = new Map()

  return {
    register(name, handler) {
      if (typeof name !== "string" || !name) throw new TypeError("rpc.register expects a method name")
      if (typeof handler !== "function") throw new TypeError(`rpc.register(${name}) expects a function`)
      if (methods.has(name)) throw new Error(`rpc method already registered: ${name}`)
      methods.set(name, handler)
      return () => {
        if (methods.get(name) === handler) methods.delete(name)
      }
    },

    has(name) {
      return methods.has(name)
    },

    async call(name, ...args) {
      const handler = methods.get(name)
      if (!handler) throw new Error(`unknown rpc method: ${name}`)
      return handler(...args)
    },
  }
}