# Omarchy-QRG — Quick Reference Guide for Omarchy

A bar button for [Omarchy](https://omarchy.org) that opens a searchable cheat-sheet panel. Ships with guides for **Neovim, Docker, Zsh and Git**, and you can add your own as plain text files.

- Type to filter across all guides, **Tab** / **Shift-Tab** to switch guide, **↑ / ↓** to move, **Enter** (or click) to copy the keys/command, **Esc** to clear / close.
- Hover a row for its example.
- Colors follow your Omarchy theme.

<p align="center">
  <img src="preview/preview.png" alt="Neovim guide in the panel" width="400"/>
  <img src="preview/preview_search.png" alt="Searching across all guides" width="400"/>
</p>

## Install

```sh
omarchy plugin add https://github.com/jcmarinn/Omarchy-QRG.git --enable
```

The shell should load it right away. Open it from the new book icon in the bar (move it with `omarchy bar move jcmarin.qrg`), or bind a key to `omarchy-shell qrg toggle`. Requires `wl-copy` (`wl-clipboard`, included with Omarchy).

If the bar button doesn't appear or `omarchy-shell qrg toggle` says the target isn't found, run `omarchy-restart-shell`. Omarchy's plugin hot reload is currently unreliable for bar widgets (see the open issue below), so a restart is the fallback.

### Updating

```sh
omarchy plugin update jcmarin.qrg
omarchy-restart-shell
```

The restart is needed **only because of a bug in Omarchy**, not because of anything in this plugin: after a plugin's files change, the shell logs "Local plugin changed, reloading" but keeps running the old code until it is restarted ([omarchy#6981](https://github.com/omacom/omarchy/issues/6981), still open; see also [#16063](https://github.com/omacom/omarchy/issues/16063)). We expect the restart to become unnecessary once that is fixed. Until then, if you skip it you will keep seeing the previous version. Your own guides in `~/.config/qrg/guides/` are never touched by an update.

## Requirements

- Omarchy (Hyprland + Quickshell) — the plugin is a bar widget for the Omarchy shell.
- `wl-copy` from `wl-clipboard` (included with Omarchy) — used to copy the selected entry.
- `omarchy-launch-editor` (part of Omarchy) — only used by `omarchy-shell qrg newGuide` to open a new guide in your editor.

Nothing else is installed, no network access is used, and the plugin never edits your Omarchy configuration. It only writes to `~/.config/qrg/guides/` when you run `newGuide`, and it never overwrites an existing file there.

## Uninstall

```sh
omarchy plugin remove jcmarin.qrg
```

It asks for confirmation (add `--yes` to skip it), disables the plugin and deletes its folder from `~/.config/omarchy/plugins/` (the repo itself stays on GitHub). If the book icon is still in the bar afterwards, run `omarchy-restart-shell`. Your own guides are not removed: delete `~/.config/qrg/` if you want them gone too.

## Add your own guide

Run:

```sh
omarchy-shell qrg newGuide tmux
```

That creates `~/.config/qrg/guides/tmux.txt` from a template and opens it in your editor. Guides are plain text — one file per tool, the file name is the guide's id:

```
# Tmux
Terminal multiplexer
@legend S=Session, W=Window, P=Pane

## Sessions
[S] tmux new -s <name>      | New session
[S] tmux attach -t <name>   | Attach        | tmux a -t work works too | #session

## Panes
[P] Ctrl-b %                | Split │
[W P] Ctrl-b z              | Zoom pane     | #zoom
```

### Marks and the legend

A **mark** is a small letter badge shown at the right of an entry. Put one or more before the keys — `[P]`, `[W P]` — using any single letters you like. They work for anything you want to tag at a glance: editor modes (the built-in Neovim guide marks `N` `I` `V` `C`), which tmux object a command acts on, which tool a command belongs to, and so on.

An optional **`@legend`** line gives the letters names, as `X=Name` pairs separated by commas. When you select a guide's tab, the panel shows a legend of the named marks that guide actually uses. Unnamed letters still get a badge, just no legend entry, and there's no legend on the **All** tab (a letter can mean different things in different guides). Letters keep a fixed color, so a mark looks the same everywhere.

| Part | Meaning |
|------|---------|
| `# Name` | Guide title (optional; defaults to the file name) |
| line after the title | One-line description (optional) |
| `## Title` | Starts a section |
| `keys \| description` | An entry — both required |
| third field | Example, shown in the hover tooltip |
| `#word #word` | Search tags (as the last field) |
| `[S W]` before the keys | Marks (badges) on the entry — any single letters |
| `@legend S=Session, P=Pane` | Optional: names the mark letters for the legend (see above) |
| `// text` | Comment |

Save the file and reopen the panel — no restart or build step. If a line is malformed, the panel shows a warning with the file and line number and skips just that line.

A file in `~/.config/qrg/guides/` with the same name as a bundled guide (say `git.txt`) **replaces** it, so you can customise the built-ins too. Your guides are outside the plugin folder, so `omarchy plugin update` never touches them.

Want a guide included for everyone? Open a pull request adding it to `guides/`.

## Development

```sh
node --test tests/parser.test.mjs     # parser + search tests
omarchy plugin validate .             # manifest check
```

Changes to the plugin's own code (`Panel.qml`, `QrgSearch.js`, …) need `omarchy-restart-shell` to take effect, whether you edit an installed clone, symlink a working copy into `~/.config/omarchy/plugins/jcmarin.qrg`, or run `omarchy plugin update` — the same Omarchy hot-reload bug ([omarchy#6981](https://github.com/omacom/omarchy/issues/6981)). Guide files (`guides/*.txt` and `~/.config/qrg/guides/`) are re-read every time the panel opens and need no restart.

There is also a web version of the same guides: [QRG-web](https://github.com/jcmarinn/QRG-web).

## License

[MIT](LICENSE)
