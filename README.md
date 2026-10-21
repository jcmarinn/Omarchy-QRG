# QRG — Quick Reference Guide

A locally-run cheat sheet collection for the tools I use (Neovim, Docker, Zsh, Git, …), searchable from two front-ends over the same data:

- **Web page** — dark, mono, card layout with search, per-guide tabs and a click-for-details dialog. Colors follow the active [Omarchy](https://omarchy.org) theme.
- **Omarchy bar plugin** — a bar button that opens a keyboard-driven search panel; Enter copies the selected keys/command.

## How it works

```
data/*.yml  ──npm run build──▶  qrg.json  ──▶  web page
 (hand-edited)  (validates)                └──▶  Omarchy plugin
```

Each tool is one YAML file in `data/`; the build validates it and emits `qrg.json`. There is no database and nothing to register — a new file becomes a new tab in both front-ends.

## Adding a guide

Create `data/<id>.yml` (the file name must equal `id`):

```yaml
id: git
name: Git
description: optional one-liner
sections:
  - name: Branches
    entries:
      - { keys: "git switch -c <name>", desc: "New branch + switch", example: "optional", tags: [branch] }
      # modal tools can add: mode: [N, V]   (N / I / V / C)
```

Unknown fields are rejected, so typos fail the build instead of silently disappearing.

## Setup

Requires Node (developed on Node 26).

```sh
npm install && (cd web && npm install)
git config core.hooksPath .githooks   # validate + rebuild on commit/pull
npm run build                         # data/*.yml -> qrg.json
cd web && npx astro dev               # web page at http://localhost:4321
```

To keep the web page running in the background, install the user service:

```sh
systemctl --user enable --now "$PWD/systemd/qrg-web.service"
```

### Omarchy plugin

Link it into your plugins folder, then enable it and restart the shell:

```sh
ln -s "$PWD/plugin/jcmarin.qrg" ~/.config/omarchy/plugins/jcmarin.qrg
omarchy plugin enable jcmarin.qrg
omarchy-restart-shell
```

Open it from the bar, or bind `omarchy-shell qrg toggle` to a key. Type to filter, **Tab** cycles guides, **↑/↓** move, **Enter** copies, **Esc** clears/closes.

> The plugin and its setup are specific to Omarchy (Hyprland + Quickshell). The data and web page work anywhere Node runs.

## License

[MIT](LICENSE)
