# docserve

Serves a folder of HTML as a card gallery with live reload.

## Features

- 🖼️ **Gallery** — card grid, iframe previews, copy path, auto date resolution
- 🔄 **Auto reload** — add/edit/delete reflected instantly via WebSocket
- 🧭 **Desktop & CLI** — control it from the menu bar or the terminal

## Desktop app

1. Download `docserve.dmg` from [Releases](../../releases)
2. Launch — docserve appears in the menu bar

Click the menu bar icon to start/stop the server.

## CLI

**npx (no install)**

```bash
npx docserve ~/reports --open   # serve a folder
npx docserve stop               # stop the running server
```

**npm install -g**

```bash
npm install -g docserve

docserve ~/reports --open   # serve a folder
docserve stop               # stop the running server
```

## Documentation

- [SPEC.html](./SPEC.html) — design & implementation specification
