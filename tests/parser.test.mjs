// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { parseGuide, parseBundle, flatten, filter } = createRequire(import.meta.url)(join(root, "QrgSearch.js"));

test("parses modes, example and tags", () => {
  const { tool, warnings } = parseGuide(
    "# Demo\nA demo guide\n\n## Moves\n[N V] w | Next word | w jumps forward | #move #word\nplain | Plain entry\n",
    "demo"
  );
  assert.deepEqual(warnings, []);
  assert.equal(tool.name, "Demo");
  assert.equal(tool.description, "A demo guide");
  assert.deepEqual(tool.sections[0].entries[0], { keys: "w", mode: ["N", "V"], desc: "Next word", example: "w jumps forward", tags: ["move", "word"] });
  assert.deepEqual(tool.sections[0].entries[1], { keys: "plain", mode: [], desc: "Plain entry", tags: [] });
});

test("tags may follow the description directly", () => {
  const { tool } = parseGuide("## S\nk | d | #a #b\n", "x");
  assert.deepEqual(tool.sections[0].entries[0].tags, ["a", "b"]);
  assert.equal(tool.sections[0].entries[0].example, undefined);
});

test("pipes without surrounding spaces stay inside keys", () => {
  const { tool } = parseGuide("## S\nalias -g G='| grep' | Global alias\n", "x");
  assert.equal(tool.sections[0].entries[0].keys, "alias -g G='| grep'");
});

test("comments and blank lines are ignored; name defaults to the file id", () => {
  const { tool, warnings } = parseGuide("// note\n\n## S\n// another\nk | d\n", "tmux");
  assert.deepEqual(warnings, []);
  assert.equal(tool.name, "Tmux");
});

test("bad lines warn with file and line number but do not drop the guide", () => {
  const { tool, warnings } = parseGuide("## S\nonly keys here\nk | d\n", "x", "x.txt");
  assert.equal(tool.sections[0].entries.length, 1);
  assert.match(warnings[0], /^x\.txt:2 /);
});

test("warning line numbers inside a bundle match the file", () => {
  const { warnings } = parseBundle("\n@@FILE /u/x.txt\n## S\nbad line\nk | d\n");
  assert.match(warnings[0], /^x\.txt:2 /);
});

test("a file without entries is skipped with a warning", () => {
  const { tool, warnings } = parseGuide("# Empty\n", "empty");
  assert.equal(tool, null);
  assert.equal(warnings.length, 1);
});

test("a later file with the same id replaces the earlier one", () => {
  const raw = "\n@@FILE /bundled/git.txt\n## A\nk | bundled\n\n@@FILE /user/git.txt\n## A\nk | mine\n\n@@FILE /user/new.txt\n## B\nk | extra\n";
  const { tools } = parseBundle(raw);
  assert.deepEqual(tools.map((t) => t.id), ["git", "new"]);
  assert.equal(tools[0].sections[0].entries[0].desc, "mine");
});

test("filter requires every term and respects the guide tab", () => {
  const rows = flatten(parseBundle("\n@@FILE a/one.txt\n## S\nfoo bar | alpha | #x\nbaz | beta\n\n@@FILE a/two.txt\n## S\nfoo | gamma\n").tools);
  assert.equal(filter(rows, "foo", "", 10).length, 2);
  assert.equal(filter(rows, "foo alpha", "", 10).length, 1);
  assert.equal(filter(rows, "foo", "two", 10).length, 1);
});

test("every bundled guide parses cleanly", () => {
  const dir = join(root, "guides");
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  assert.ok(files.length >= 4);
  const raw = files.map((f) => `\n@@FILE ${join(dir, f)}\n${readFileSync(join(dir, f), "utf8")}`).join("");
  const { tools, warnings } = parseBundle(raw);
  assert.deepEqual(warnings, []);
  assert.equal(tools.length, files.length);
});
