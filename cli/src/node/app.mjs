import { H3 } from "h3/node"
import { registerRoutes } from "./routes.mjs"
import { registerFiles } from "./rpc/files.mjs"
import { createRpc } from "./rpc/index.mjs"
import { registerRpcRoute } from "./rpc/route.mjs"
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
  registerRpcRoute(app, rpc)
  registerRoutes(app, { docsDir })
  return app
}
