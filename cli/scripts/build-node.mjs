import { rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const outdir = new URL("../dist/node/", import.meta.url)

await rm(outdir, { recursive: true, force: true })
await build({
  entryPoints: [fileURLToPath(new URL("../src/node/cli.mjs", import.meta.url))],
  outfile: fileURLToPath(new URL("cli.mjs", outdir)),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
})
