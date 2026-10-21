# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Omarchy-QRG**: an Omarchy shell plugin (`bar-widget`) that opens a keyboard-driven search panel over cheat-sheet guides. The repo root *is* the plugin (installed by `omarchy plugin add <git url>`), so `manifest.json` must stay at the root. The web version lives in a separate repo, `QRG-web`, which reads this repo's `guides/` and `QrgSearch.js`.

## Layout

```
manifest.json     plugin manifest (id jcmarin.qrg)
BarWidget.qml     bar button + IPC target `qrg` (toggle/open/close/newGuide)
Panel.qml         search panel (KeyboardPanel); loads guides via a `sh` Process on every open
QrgSearch.js      guide parser + filter; plain JS, also require()d by Node tests and QRG-web
guides/*.txt      bundled guides (source of truth, hand-edited)
tests/            node:test suite for the parser
```

## Guide format

`guides/<id>.txt` (file name = id):

```
# Name
optional one-line description

## Section
[N V] keys | description | optional example | #tag #tag
// comment
```

Only `keys | description` are required; `[N V]` modes are N/I/V/C; a field made only of `#words` is tags; the splitter is the literal ` | ` (space-pipe-space), so keys may contain a bare `|`. Users add guides in `~/.config/qrg/guides/`; a user file with the same id replaces the bundled one. Parsing never throws — bad lines become warnings shown in the panel.

## Commands

- `node --test tests/parser.test.mjs` — run the tests (no dependencies, no build step).
- `omarchy plugin validate .` — check the manifest.
- **Running copy:** the plugin the shell runs is a real clone installed with `omarchy plugin add https://github.com/jcmarinn/Omarchy-QRG.git --enable`, in `~/.config/omarchy/plugins/jcmarin.qrg` — not a symlink to this checkout. To try a change: commit and push, then `omarchy plugin update jcmarin.qrg` (the shell hot-reloads the installed folder; no restart). Quick experiments can also be edited directly in the installed clone, but copy them back here and commit.
- If you ever symlink this checkout into `~/.config/omarchy/plugins/` instead (`omarchy plugin remove` the clone first — the installer refuses a duplicate id), symlinked plugins are **not** hot-reloaded: run `omarchy-restart-shell` after QML changes.
- Plain data changes in `guides/` or `~/.config/qrg/guides/` are picked up the next time the panel opens.

## Conventions

- Keep descriptions terse (≈ 2–4 words, arrows `→ ←` instead of "to/from"); this is a quick-reference panel.
- Keep `QrgSearch.js` free of QML/Node APIs and keep the `module.exports` guard at the bottom — QML, Node and QRG-web all load it.
- Never edit `/usr/share/omarchy/`.
- Target host is Omarchy (Arch + Hyprland + Quickshell). Needs `wl-copy`.
