---
workflow: general-video
flow: companion
storyboard: yes
message: "Your AI writes HTML by the dozen — docserve turns the folder into a live gallery"
destination: youtube (primary; GitHub README embed)
aspect: 1920x1080
language: en
audience: developers — macOS / Node users whose AI agents generate piles of HTML
length: 30s
angle: list-tool-gallery — open on the pre-docserve reality (a plain, growing list of AI-generated HTML files), the list rows converge into the docserve mark, then the film lives inside the gallery it just opened: pick a folder in a file picker → gallery assembles, live reload on the served page, macOS/CLI/VS Code, end-card with Download CTA + GitHub badge
---

## Intent

Introduce docserve — a zero-dependency tool that serves a folder of HTML as a card
gallery with live reload (macOS menubar app + Node CLI + VS Code extension). The
story runs in six beats: ① a plain, growing list of AI-generated HTML files (the
viewer's own output folder, pre-docserve) · ② the list rows converge into the docserve mark ·
③ a file picker selects the folder → the gallery assembles live, one card per beat ·
④ an edit in the editor auto-reflects on the served page itself (rebuilt report page, live text swap — no screenshots) ·
⑤ three equal surfaces: macOS app, CLI (`npx @noy4/
docserve` shown as text, never typed), VS Code extension · ⑥ end-card: docserve
lockup + Download CTA + GitHub star badge. From frame 3 the film lives inside the
gallery world; the portal-dive staging starts there. "0 dependencies" gets no beat.
The one message: 「AIがHTMLを山ほど作る。フォルダを指定したら、もうギャラリーだ」— your AI's
output is one folder-pick away from being a live site.

## Assets

- assets/icon.svg — the docserve app icon (copied from desktop/build/icon.svg): frame 2 mark, frame 3 gallery favicon, frame 6 lockup
- assets/tray-running@2x.png + assets/menu-running@2x.png — the shipped tray/menu icons (desktop/src/assets/), frame 5 macOS column
- /Users/noy/repos/project/docserve/cli/index.html — the shipped gallery template; reference for the real gallery grid rebuilt in frame 3 (card #1a1d27, hairline #2a2e3d, 12px radius, favicon + title + date meta, copy-path button, #6c8cff hover). Not used for frame 5 (free-standing columns).
- GitHub mark + star: inline SVG (frame 6 badge)

## Customizations

- Frame 1 opens OUTSIDE the gallery: a clean, growing file list of AI-generated HTML rows (generic filenames, no vendor logos)
- Frame 2's assemble uses the list itself — the file rows become the docserve mark
- Frame 3 merges the file-picker pick with the signature grid-card-assembly: the "answer" builds live on the beat, not a static plate — and the payoff grid is the REAL gallery chrome (cli/index.html: header, #1a1d27 cards, dark-skinned previews #0f1117 (film deviation from the template's white iframes), favicon + title + date meta). No status line under the picker.
- Live reload proven on the actual served page (browser-visible page state swaps in place), never on the gallery grid
- Frame 4 is paced tight (6s): couple → retype+edit → pulse & page swap → landing line, no long holds. Edited wording: `Investigating` → `Resolved` on an AI-generated incident report (orange→green; callback to frame 1's file list and frame 3's gallery card). The served page is REBUILT in HTML chrome — no screenshots anywhere.
- Frame 5 shows three equal surfaces as FREE-STANDING columns (no card boxes) — **surface figure on TOP, platform icon + label below** (labels: "macOS app" / "CLI" / "VS Code extension"), vertical hairlines between columns (macOS: mini menu bar with the real tray icon + dropdown `✓ Running` / `▸ reports (~)` / `Open Folder...` / `Stop All` — tray-running@2x.png / menu-running@2x.png · CLI: one-line terminal `$ npx @noy4/docserve` only · VS Code: mini editor with exaggerated real status bar item `⊞ :4242` codicon per docs/VSCODE_PLAN.html) — no screenshots
- VO lines adopted: F1 "You might have a lot of HTML by now — your AI wrote it." (copy stays "Your AI writes HTML. / Lots of it.") · F3 "Pick a folder — and there's your gallery." · F4 "Every edit shows up on the page — instantly." · F6 "Try docserve — free and open source."
- Frame 6 is a clean end-card, no staging: docserve lockup (icon + wordmark) centered → "Download for macOS" pill with the Apple mark → GitHub star badge (★ noy4/docserve). No gallery, no card drop, no pulse, no URL line
- English TTS narration over BGM — six short VO lines, one per frame (see STORYBOARD.md); BGM ducks under VO. On-screen copy stays kinetic type.

## Notes

- Design tokens from the site (dark-first): --bg #0B0E14, --surface #151A23, --surface-2 #21252F, --border #2C313F, --border-strong #383F50, --text #C3CDDC, --text-strong #F7F9FC, --muted #7E8A9E, --primary #4465DB, --primary-soft rgba(68,101,219,.15), --accent #F08A59, --accent-soft rgba(240,138,89,.15); font Geist Mono (mono aesthetic throughout).
- On-screen language English (GitHub/international audience); chat with the user in Japanese.
- Avoid: generic screen-recording feel, bullet-list feature slides, slow zooms on static screenshots, "0 dependencies" as a story beat.
- Integrations: macOS menubar app FIRST (hero path); VS Code extension + CLI mentioned as breadth only (frame 5 columns), never demonstrated with typing.
