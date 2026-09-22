<img src="desktop/build/icon.svg" width="200" alt="docserve icon">

# docserve

Serves a folder of HTML as a card gallery with live reload.

## ✨ Features

- 🖼️ **Gallery** — card grid, iframe previews, copy path, auto date resolution
- 🔄 **Auto reload** — add/edit/delete reflected instantly via WebSocket
- 🧭 **Desktop & CLI** — control it from the menu bar or the terminal

## 🖥️ Desktop app

1. **Download** — the DMG for your Mac from [Releases](../../releases) (`arm64` for Apple Silicon, x64 otherwise)
2. **Launch** — pick a folder and the gallery opens in your browser

Click the menu bar icon to manage the server.

## ⌨️ CLI

**Run without installing**

```bash
npx docserve ~/reports --open   # serve a folder
npx docserve stop               # stop the running server
```

**Install globally**

```bash
npm install -g docserve

docserve ~/reports --open   # serve a folder
docserve stop               # stop the running server
```

## 📚 Documentation

- [SPEC.html](./SPEC.html) — design & implementation specification

## ⚖️ License

[MIT](./LICENSE)
