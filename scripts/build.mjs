// Validates data/*.yml and emits dist/qrg.json (+ a copy for the Omarchy plugin).
// Any new data/<tool>.yml is picked up automatically; no registration needed.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const outputs = [join(root, "dist", "qrg.json"), join(root, "web", "public", "qrg.json"), join(root, "plugin", "jcmarin.qrg", "qrg.json")];

const MODES = ["N", "I", "V", "C"];
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

const errors = [];
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim() !== "";

function checkKeys(obj, allowed, where) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) errors.push(`${where}: unknown field "${k}" (allowed: ${allowed.join(", ")})`);
  }
}

function normalizeEntry(e, where) {
  if (!isObj(e)) return errors.push(`${where}: entry must be a mapping`), null;
  checkKeys(e, ["keys", "mode", "desc", "example", "tags"], where);
  if (!isStr(e.keys)) errors.push(`${where}: "keys" is required (non-empty string)`);
  if (!isStr(e.desc)) errors.push(`${where}: "desc" is required (non-empty string)`);
  if (e.example !== undefined && !isStr(e.example)) errors.push(`${where}: "example" must be a non-empty string`);

  let mode = [];
  if (e.mode !== undefined) {
    mode = Array.isArray(e.mode) ? e.mode : [e.mode];
    for (const m of mode) {
      if (!MODES.includes(m)) errors.push(`${where}: invalid mode ${JSON.stringify(m)} (use ${MODES.join("/")})`);
    }
  }

  let tags = [];
  if (e.tags !== undefined) {
    if (Array.isArray(e.tags) && e.tags.every(isStr)) tags = e.tags;
    else errors.push(`${where}: "tags" must be a list of strings`);
  }

  return { keys: e.keys, mode, desc: e.desc, ...(e.example !== undefined && { example: e.example }), tags };
}

function normalizeTool(doc, file) {
  const where = file;
  if (!isObj(doc)) return errors.push(`${where}: top level must be a mapping`), null;
  checkKeys(doc, ["id", "name", "description", "sections"], where);

  const expectedId = basename(file, ".yml");
  if (!isStr(doc.id) || !ID_RE.test(doc.id)) errors.push(`${where}: "id" must match ${ID_RE}`);
  else if (doc.id !== expectedId) errors.push(`${where}: id "${doc.id}" must match the file name "${expectedId}"`);
  if (!isStr(doc.name)) errors.push(`${where}: "name" is required`);
  if (doc.description !== undefined && !isStr(doc.description)) errors.push(`${where}: "description" must be a non-empty string`);
  if (!Array.isArray(doc.sections) || doc.sections.length === 0) {
    errors.push(`${where}: "sections" must be a non-empty list`);
    return null;
  }

  const sections = doc.sections.map((s, i) => {
    const sw = `${where} section[${i}]`;
    if (!isObj(s)) return errors.push(`${sw}: must be a mapping`), null;
    checkKeys(s, ["name", "entries"], sw);
    if (!isStr(s.name)) errors.push(`${sw}: "name" is required`);
    if (!Array.isArray(s.entries) || s.entries.length === 0) {
      errors.push(`${sw}: "entries" must be a non-empty list`);
      return null;
    }
    const entries = s.entries.map((e, j) => normalizeEntry(e, `${sw} (${s.name ?? "?"}) entry[${j}]`)).filter(Boolean);
    return { name: s.name, entries };
  }).filter(Boolean);

  return { id: doc.id, name: doc.name, ...(doc.description && { description: doc.description }), sections };
}

const files = (await readdir(dataDir)).filter((f) => f.endsWith(".yml")).sort();
if (files.length === 0) errors.push("data/: no .yml files found");

const tools = [];
for (const file of files) {
  try {
    const tool = normalizeTool(parse(await readFile(join(dataDir, file), "utf8")), file);
    if (tool) tools.push(tool);
  } catch (err) {
    errors.push(`${file}: YAML parse error: ${err.message}`);
  }
}

if (errors.length) {
  console.error(`qrg build failed with ${errors.length} error(s):\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

const json = JSON.stringify({ tools }, null, 2) + "\n";
for (const out of outputs) {
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, json);
}

// Web palette follows the active Omarchy theme; falls back to the CSS defaults if it can't be read.
const themeToml = join(homedir(), ".local/state/omarchy/current/theme/colors.toml");
const themeCss = join(root, "web", "public", "theme.css");
try {
  const c = Object.fromEntries([...(await readFile(themeToml, "utf8")).matchAll(/^(\w+)\s*=\s*"([^"]*)"/gm)].map((m) => [m[1], m[2]]));
  const vars = {
    bg: c.background, "bg-dark": c.darker_background, panel: c.dark_background, "panel-hi": c.lighter_background,
    line: c.muted, fg: c.bright_foreground, dim: c.foreground, accent: c.bright_blue, "accent-fill": c.accent,
    N: c.green, I: c.yellow, C: c.cyan, danger: c.red,
    t1: c.orange, t2: c.green, t3: c.yellow, t5: c.cyan, t6: c.bright_magenta,
  };
  const css = Object.entries(vars).filter(([, v]) => v).map(([k, v]) => `  --${k}: ${v};`).join("\n");
  await writeFile(themeCss, `:root {\n${css}\n}\n`);
  console.log(`qrg: theme ${c.mode ?? "?"} -> web/public/theme.css`);
} catch {
  await writeFile(themeCss, "");
  console.log("qrg: Omarchy theme not found, web uses default colors");
}

const count = tools.reduce((n, t) => n + t.sections.reduce((m, s) => m + s.entries.length, 0), 0);
console.log(`qrg: ${tools.length} tools, ${count} entries -> ${outputs.map((o) => o.replace(root + "/", "")).join(", ")}`);
