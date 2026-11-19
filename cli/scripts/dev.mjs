import { execFileSync, spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { build } from "vite"

const root = fileURLToPath(new URL("..", import.meta.url))
const configFile = fileURLToPath(new URL("../vite.config.ts", import.meta.url))
const bin = fileURLToPath(new URL("../bin.mjs", import.meta.url))
const buildNode = fileURLToPath(new URL("./build-node.mjs", import.meta.url))

const argv = process.argv.slice(2)
const forwarded = argv[0] === "--" ? argv.slice(1) : argv
const serverArgs = forwarded.length === 0
  ? ["../docs/docs", "--port", "4300", "--open"]
  : forwarded[0].startsWith("-")
    ? ["../docs/docs", ...forwarded]
    : forwarded

let watcher = null
let server = null
let stopping = false

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

try {
  execFileSync(process.execPath, [buildNode], { cwd: root, stdio: "inherit" })
  watcher = await build({ configFile, root, build: { watch: {} } })
  await firstBuild(watcher)

  server = spawn(process.execPath, [bin, ...serverArgs], { cwd: root, stdio: "inherit" })
  server.once("exit", (code) => shutdown(code ?? 0))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  await shutdown(1)
}

function firstBuild(instance) {
  return new Promise((resolve, reject) => {
    const onEvent = (event) => {
      if (event.code === "END") {
        instance.off("event", onEvent)
        resolve()
      } else if (event.code === "ERROR") {
        instance.off("event", onEvent)
        reject(event.error)
      }
    }
    instance.on("event", onEvent)
  })
}

async function shutdown(code) {
  if (stopping) return
  stopping = true

  const timer = setTimeout(() => {
    server?.kill("SIGKILL")
    process.exit(code)
  }, 3000)
  timer.unref()

  await Promise.all([
    watcher?.close(),
    new Promise((resolve) => {
      if (!server || server.exitCode !== null || server.signalCode !== null) {
        resolve()
        return
      }
      server.once("exit", resolve)
      server.kill("SIGTERM")
    }),
  ])

  clearTimeout(timer)
  process.exit(code)
}
