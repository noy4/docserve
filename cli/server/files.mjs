// File metadata for /api/files: recursive *.html listing (excluding index.html),
// <title> / <meta name="created_at"> extraction, and git date maps cached per
// repo root.
//
// Created-date priority: meta created_at > oldest git add commit > birthtime.
import { open, readdir, stat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

// Walk docsDir recursively and collect .html files; any index.html is excluded
// from the gallery.
export async function listHtmlFiles(docsDir, out = []) {
  let entries;
  try {
    entries = await readdir(docsDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(docsDir, entry.name);
    if (entry.isDirectory()) {
      await listHtmlFiles(full, out);
    } else if (entry.name.endsWith(".html") && entry.name !== "index.html") {
      out.push(full);
    }
  }
  return out;
}

// /api/files payload, sorted by created desc with title/path tiebreaks.
export async function apiFiles(docsDir) {
  const paths = await listHtmlFiles(docsDir);
  const { created, modified } = await gitDateMaps(docsDir);
  const files = [];
  for (const full of paths) {
    let st;
    try {
      st = await stat(full);
    } catch {
      continue; // deleted between listing and stat
    }
    const { title, date } = await metaOf(full, st.mtimeMs);
    let key;
    try {
      key = realpathSync(full);
    } catch {
      continue;
    }
    const rel = relative(docsDir, full).split(sep).join("/");
    files.push({
      title: title ?? basename(full),
      url: `/${rel}`,
      path: full,
      created: date ?? created.get(key) ?? Math.floor(st.birthtimeMs / 1000),
      modified: modified.get(key) ?? Math.floor(st.mtimeMs / 1000),
    });
  }
  files.sort((a, b) => b.created - a.created || a.title.localeCompare(b.title, "ja") || a.url.localeCompare(b.url));
  return files;
}

// <title> + <meta name="created_at"> extracted from the head of a report; cached by
// path + mtime so repeated /api/files calls only re-read files that changed.
const metaCache = new Map(); // "path:mtimeMs" -> { title, created }

async function metaOf(full, mtimeMs) {
  const key = `${full}:${mtimeMs}`;
  const cached = metaCache.get(key);
  if (cached !== undefined) return cached;
  const meta = await extractMeta(full);
  metaCache.set(key, meta);
  return meta;
}

async function extractMeta(full) {
  const findTitle = (text) => text.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? null;
  const findDate = (text) => {
    for (const tag of text.match(/<meta\b[^>]*>/gi) ?? []) {
      if (!/\bname\s*=\s*["']created_at["']/i.test(tag)) continue;
      const d = new Date(tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() ?? "");
      if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);
    }
    return null;
  };
  try {
    const handle = await open(full, "r");
    try {
      const read = async (len, pos) => {
        const { buffer, bytesRead } = await handle.read(Buffer.alloc(len), 0, len, pos);
        return buffer.toString("utf8", 0, bytesRead);
      };
      // Titles and meta tags live in <head>; read only the first 4 KB.
      const head = await read(4096, 0);
      let meta = { title: findTitle(head), date: findDate(head) };
      if (meta.title === null || meta.date === null) {
        // Fallback for documents with a long preamble (inline favicon etc.).
        const text = await read(1 << 20, 0);
        meta = {
          title: meta.title ?? findTitle(text),
          date: meta.date ?? findDate(text),
        };
      }
      return meta;
    } finally {
      await handle.close();
    }
  } catch {
    return { title: null, date: null };
  }
}

// Resolve created/modified dates from git history, keyed by absolute path.
// A single full-repo scan with cwd set to the docs dir, cached per repo root in
// module scope. git log outputs newest first: overwriting keeps the oldest add
// (= creation date) and the newest touch (= modified date).
const gitMapsCache = new Map(); // repo root (or docsDir when not a repo) -> { created, modified }

async function gitDateMaps(docsDir) {
  const cwd = realpath(docsDir);
  const top = (await git(["rev-parse", "--show-toplevel"], cwd)).trim();
  const root = top ? realpath(top) : null;
  const cacheKey = root ?? cwd;
  let maps = gitMapsCache.get(cacheKey);
  if (maps) return maps;

  maps = { created: new Map(), modified: new Map() };
  if (root) {
    try {
      const [first, last] = await Promise.all([
        git(["log", "--diff-filter=A", "--name-only", "--format=c:%at"], cwd),
        git(["log", "--name-only", "--format=m:%at"], cwd),
      ]);
      let ts;
      for (const line of first.split("\n")) {
        if (line.startsWith("c:")) {
          ts = parseInt(line.slice(2), 10);
        } else if (line && ts !== undefined) {
          maps.created.set(join(root, line), ts); // oldest add wins
        }
      }
      ts = undefined;
      for (const line of last.split("\n")) {
        if (line.startsWith("m:")) {
          ts = parseInt(line.slice(2), 10);
        } else if (line && ts !== undefined) {
          maps.modified.set(join(root, line), ts); // newest touch wins
        }
      }
    } catch {
      // unreadable history → fall back to fs dates
    }
  }
  gitMapsCache.set(cacheKey, maps);
  return maps;
}

async function git(args, cwd) {
  try {
    const { stdout } = await run("git", args, { cwd, timeout: 10000, maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch {
    return "";
  }
}

// On macOS /var is a symlink to /private/var; canonicalize to real paths so
// lookups match git output.
function realpath(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
