<img src="desktop/build/icon.svg" width="200" alt="docserve icon">

# docserve

Serves a folder of HTML as a card gallery with live reload.

## ✨ Features

- 🖼️ **Gallery** — card grid, iframe previews, copy path, auto date resolution
- 🔄 **Auto reload** — add/edit/delete reflected instantly via WebSocket
- 🧭 **Desktop & CLI** — control it from the menu bar or the terminal

## 🖥️ Desktop app

1. **Download** — the DMG for your Mac from [Releases](../../releases) (`arm64` for Apple Silicon)
2. **Launch** — on the security warning, click **Done** (not **Move to Trash**), then approve via **Open Anyway** in `System Settings → Privacy & Security` (the app isn't verified by Apple — that requires joining the Apple Developer Program, $99/year)
3. **Pick a folder** — the gallery opens in your browser

Click the menu bar icon to manage the server.

## ⌨️ CLI

**Run without installing**

```bash
npx @noy4/docserve ~/reports --open   # serve a folder (npx @noy4/docserve <folder>)
npx @noy4/docserve stop               # stop the running server
```

**Install globally**

```bash
npm install -g @noy4/docserve

docserve ~/reports --open   # serve a folder (docserve <folder>)
docserve stop               # stop the running server
```

## 📚 Documentation

- [SPEC.html](./SPEC.html) — design & implementation specification

## ⚖️ License

[MIT](./LICENSE)
