#!/usr/bin/env node
import { existsSync } from "node:fs"

const entry = new URL("./dist/node/cli.mjs", import.meta.url)

if (!existsSync(entry)) {
  console.error("[docserve] Missing dist/node/cli.mjs. Run `npm run build`.")
  process.exit(1)
}

const { main } = await import(entry.href)

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exit(1)
})
