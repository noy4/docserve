export class RpcError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = "RpcError"
    this.status = status
  }
}

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

    names() {
      return [...methods.keys()]
    },

    async call(name, args = []) {
      if (!Array.isArray(args)) throw new RpcError("args must be an array", 400)
      const handler = methods.get(name)
      if (!handler) throw new RpcError(`Unknown RPC method: ${name}`, 404)
      return handler(...args)
    },
  }
}
