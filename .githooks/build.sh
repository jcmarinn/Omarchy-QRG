#!/bin/sh
# Shared by the hooks: rebuild qrg.json from data/*.yml.
# Hooks run without the interactive shell setup, so find node via mise if needed.
cd "$(git rev-parse --show-toplevel)" || exit 1
if ! command -v node >/dev/null 2>&1 && command -v mise >/dev/null 2>&1; then
  eval "$(mise env -s sh 2>/dev/null)"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "qrg hook: node not found, skipping build" >&2
  exit 0
fi
[ -d node_modules ] || npm install --silent
npm run build --silent
