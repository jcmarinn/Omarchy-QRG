# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

QRG (quick reference guide) is a **new project** — only scaffolding exists so far. There are no build/lint/test commands yet; add them here as they are created.

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
- The plugin is symlinked: `~/.config/omarchy/plugins/jcmarin.qrg` → `plugin/jcmarin.qrg` in this repo. Never edit `/usr/share/omarchy/`; plugin QML hot-reloads on save (`omarchy-shell shell rescanPlugins` forces it).

These are decisions made, not yet implemented — update this file as they land.

## Environment Notes

- Lives at `~/Apps/QRG`, deliberately outside the Google Drive–synced Documents tree; backup is the GitHub remote.
- Host is Omarchy (Arch + Hyprland + Quickshell). Node 26 (via mise), python3, sqlite3 are available; bun is not installed.
