import { readBody } from "h3/node"
import { json } from "../http/response.mjs"
import { RpcError } from "./index.mjs"

/**
 * @param {import("h3/node").H3} app
 * @param {{ call: (name: string, args?: any[]) => Promise<any> }} rpc
 */
export function registerRpcRoute(app, rpc) {
  app.post("/__docserve/rpc", async (event) => {
    let payload
    try {
      payload = await readBody(event)
    } catch {
      return json({ error: { message: "Invalid JSON body" } }, 400)
    }

    const data = /** @type {{ method?: unknown, args?: unknown }} */ (payload)
    const method = data?.method
    const args = data?.args ?? []
    if (typeof method !== "string" || !method)
      return json({ error: { message: "method must be a string" } }, 400)
    if (!Array.isArray(args))
      return json({ error: { message: "args must be an array" } }, 400)

    try {
      return json({ result: await rpc.call(method, args) })
    } catch (error) {
      const status = error instanceof RpcError ? error.status : 500
      if (!(error instanceof RpcError)) console.error(error)
      return json({ error: { message: error instanceof Error ? error.message : String(error) } }, status)
    }
  })
}
