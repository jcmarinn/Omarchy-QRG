# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

QRG (quick reference guide). **Phase 1 (data layer) is done**: YAML schema, starter guides (nvim, docker, zsh) and the build script. **Web front-end is a first draft** (`web/`, single Astro page, client-side search, themed from the active Omarchy theme via the generated `web/public/theme.css`; runs as the user service `qrg-web` at http://127.0.0.1:4321 — unit in `systemd/qrg-web.service`, installed with `systemctl --user enable --now $PWD/systemd/qrg-web.service`; manage with `systemctl --user restart|status qrg-web`, logs via `journalctl --user -u qrg-web`; needs `cd web && npm install` once). **Plugin is a first draft** (`plugin/jcmarin.qrg/`: bar button + search panel with section headers; Tab cycles guides, Enter copies keys; `omarchy-shell qrg toggle` opens it).

## Commands

- `npm install` once, then `npm run build` — validates `data/*.yml` and writes `dist/qrg.json` plus copies in `web/public/` and `plugin/jcmarin.qrg/` (all gitignored). Exits non-zero listing every schema error. No tests/lint yet.
- Git hooks live in `.githooks/` (versioned). After a fresh clone run `git config core.hooksPath .githooks`. `pre-commit` runs the build, so an invalid guide blocks the commit; `post-merge` and branch `post-checkout` rebuild so pulled guides show up. Hooks fire on git events, not on file save — run `npm run build` by hand after editing YAML outside a commit.

## Adding a guide

Drop `data/<id>.yml` in place (file name must equal `id`, lowercase/digits/hyphens) and run the build — no registration anywhere else. Shape:

```yaml
id: git
name: Git
description: optional one-liner
sections:
  - name: Branches
    entries:
      - { keys: "git switch -c <name>", desc: "Create and switch", example: "optional", tags: [branch] }
      # mode is only for modal tools: mode: [N, V]  (N/I/V/C)
```

Unknown fields are rejected (catches typos). In `qrg.json`, `mode` is always an array (empty when not modal) and `tags` always an array.

## Goal

A locally-run cheat sheet database for frequently used tools (nvim, docker, zsh, ...), consulted through two front-ends over the same data:

1. A static web front-end, styled after https://neovimcheatsheet.com/ (dark, mono font, `/` focuses search, section lists, N/I/V/C mode badges, click an entry for description/example/Copy).
2. An Omarchy shell plugin: a `bar-widget` button in the bar that opens a search panel (same pattern as `~/.config/omarchy/plugins/omaplug`; `jcmarin.emojis` is the reference for load-JSON-and-filter).

## Planned Architecture

```
data/*.yml            one YAML file per tool — the only files edited by hand (source of truth)
scripts/build.mjs     validates YAML against the schema and emits dist/qrg.json
web/                  Astro static site, client-side search over qrg.json
plugin/jcmarin.qrg/   Omarchy plugin (manifest.json, BarWidget.qml, Panel.qml)
```

- Both front-ends read the same generated `qrg.json`; keep lookup logic out of the UI layers. The build also writes `qrg.json` into the plugin folder.
- Entry model: tool → sections → entries (`keys`, optional `mode` N/I/V/C, `desc`, optional `example`, `tags`). Docker/zsh entries have no modes, so `keys` is a command or shortcut.
- **No database.** SQLite/Postgres were considered and rejected: the data is small, read-only at runtime, and filtered in memory. Only revisit if a terminal `qrg search` CLI or ranked full-text search is wanted.
- The plugin is symlinked: `~/.config/omarchy/plugins/jcmarin.qrg` → `plugin/jcmarin.qrg` in this repo. Never edit `/usr/share/omarchy/`; plugin QML hot-reloads on save **only for non-symlinked plugins** — because ours is a symlink, edits are not picked up; run `omarchy-restart-shell` after changing QML.

These are decisions made, not yet implemented — update this file as they land.

## Environment Notes

- Lives at `~/Apps/QRG`, deliberately outside the Google Drive–synced Documents tree; backup is the GitHub remote.
- Host is Omarchy (Arch + Hyprland + Quickshell). Node 26 (via mise), python3, sqlite3 are available; bun is not installed.
