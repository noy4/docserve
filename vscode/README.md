# docserve for VS Code

Serve a folder of HTML as a card gallery with live reload — control [docserve](https://github.com/noy4/docserve) from the VS Code status bar.

- **Serve a folder** — start a docserve server for the current workspace
- **See what's running** — one glance at the status bar, full list one click away
- **Open the gallery** — jump to the card grid in your browser
- **Stop servers** — per folder or all at once

The extension is a thin client over the [docserve CLI](https://www.npmjs.com/package/@noy4/docserve): servers started from the terminal or the macOS menu bar app show up here too.

## Requirements

- Node.js ≥ 22.12 (for `npx @noy4/docserve`)

## Commands

| Command | Title |
| --- | --- |
| `docserve.start` | docserve: Serve a folder |
| `docserve.open` | docserve: Open gallery |
| `docserve.stop` | docserve: Stop server |
| `docserve.stopAll` | docserve: Stop all servers |
| `docserve.list` | docserve: Show running servers |

## License

[MIT](../LICENSE)
