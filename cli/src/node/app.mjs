import { H3 } from "h3/node"
import { createHandler } from "./routes.mjs"

/**
 * @param {{ docsDir: string }} options
 * @returns {H3}
 */
export function createApp({ docsDir }) {
  const app = new H3()
  const handler = createHandler({ docsDir })
  app.all("/**", (event) => handler(event.req))
  return app
}
