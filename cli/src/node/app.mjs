import { H3, readBody } from "h3/node"
import { createHandler } from "./routes.mjs"
import { registerFiles } from "./rpc/files.mjs"
import { createRpc, RpcError } from "./rpc/index.mjs"
import { registerServers } from "./rpc/servers.mjs"

/**
 * @param {{ docsDir: string }} options
 * @returns {H3}
 */
export function createApp({ docsDir }) {
  const app = new H3()
  const rpc = createRpc()
  registerFiles(rpc, { docsDir })
  registerServers(rpc, { docsDir })

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

  const handler = createHandler({ docsDir })
  app.all("/**", (event) => handler(event.req))
  return app
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  })
}
