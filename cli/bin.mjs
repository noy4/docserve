#!/usr/bin/env node
// docserve — serve a folder of HTML as a card gallery with live reload.
//
//   docserve [dir] [command] [options]
//
// Flow (Phase 1: foreground start only):
//   parse args ──▶ resolve docsDir (missing → exit 1) ──▶ runServer()
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { runServer } from "./server/index.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const DEFAULT_PORT = 4242;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      open: { type: "boolean" },
      port: { type: "string" },
    },
  });

  const docsDir = path.resolve(positionals[0] ?? ".");
  if (!isDirectory(docsDir)) {
    console.error(`[docserve] Directory not found: ${docsDir}`);
    process.exit(1);
  }

  let port = DEFAULT_PORT;
  if (values.port !== undefined) {
    port = Number(values.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      console.error(`[docserve] --port expects an integer between 1 and 65535, got "${values.port}"`);
      process.exit(1);
    }
  }

  console.log(`docserve v${pkg.version}`);
  console.log(`docs : ${docsDir}`);
  await runServer({ docsDir, port, open: values.open ?? false });
}

function isDirectory(path) {
  try {
    return fs.statSync(path).isDirectory();
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
