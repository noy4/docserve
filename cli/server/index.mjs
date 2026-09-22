// docserve server core: HTTP layer + runtime state lifecycle.
//
// ┌────────────────────────────────────────────────────────┐
// │ runServer()                                            │
// │ ├─ createServer ──▶ handler()                          │ # HTTP
// │ │   ├─ /, /index.html ──▶ gallery template             │
// │ │   └─ other paths ──▶ raw files from docsDir          │
// │ └─ listen ──▶ writeState({pid, port, url, docsDir})    │
// └────────────────────────────────────────────────────────┘
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { clearState, writeState } from "./state.mjs";

const MAX_PORT_TRIES = 20; // on conflict, try the next port up to 20 times
const INDEX_TEMPLATE = resolve(import.meta.dirname, "..", "index.html");

const MIME = {
  ".html": "text/html",
  ".htm": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".xml": "application/xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function runServer({ docsDir, port: initialPort, open = false }) {
  let port = initialPort; // actually bound port (may fall back +1 on conflict)

  const cleanup = () => clearState();
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  const server = createServer(createNodeServerAdapter(createHandler({ docsDir })));
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && port < initialPort + MAX_PORT_TRIES) {
      port += 1;
      server.listen(port, "127.0.0.1");
    } else {
      console.error(err);
      process.exit(1);
    }
  });
  server.listen(port, "127.0.0.1", () => {
    const state = { pid: process.pid, port, url: `http://localhost:${port}/`, docsDir };
    writeState(state);
    console.log(state.url);
    if (open && process.platform === "darwin") exec(`open ${state.url}`);
  });
  return { server };
}

// --- Node server adapter ---

function createNodeServerAdapter(handler) {
  return async (req, res) => {
    try {
      const response = await handler(toWebRequest(req));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("Internal Server Error");
    }
  };
}

function toWebRequest(req) {
  const host = req.headers.host || "localhost";
  return new Request(`http://${host}${req.url}`, { method: req.method, headers: req.headers });
}

// --- HTTP handler ---

function createHandler({ docsDir }) {
  return async function handler(request) {
    const url = new URL(request.url);

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    if (pathname === "/" || pathname === "/index.html") {
      return galleryResponse(docsDir);
    }

    if (pathname.includes("\0")) {
      return new Response("Bad Request", { status: 400 });
    }

    const path = resolve(docsDir, pathname.slice(1));
    if (!isWithin(docsDir, path)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const body = await readFile(path);
      const type = MIME[extname(path).toLowerCase()] || "application/octet-stream";
      const headers = { "content-type": type === "text/html" ? "text/html; charset=utf-8" : type };
      return new Response(body, { headers });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  };
}

// The gallery is an embedded template served at / and /index.html; docsDir's own
// index.html is shadowed by it. __DOCSERVE_DIR__ is substituted for display.
async function galleryResponse(docsDir) {
  try {
    let html = await readFile(INDEX_TEMPLATE, "utf8");
    html = html.replaceAll("__DOCSERVE_DIR__", escapeHtml(docsDir));
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return new Response("Gallery template missing", { status: 500 });
  }
}

// --- Path utilities ---

function isWithin(base, path) {
  const rel = relative(base, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
