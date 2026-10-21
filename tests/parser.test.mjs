// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { markColor, parseGuide, parseBundle, legendFor, flatten, filter } = createRequire(import.meta.url)(join(root, "QrgSearch.js"));

test("parses marks, example and tags", () => {
  const { tool, warnings } = parseGuide(
    "# Demo\nA demo guide\n\n## Moves\n[N V] w | Next word | w jumps forward | #move #word\nplain | Plain entry\n",
    "demo"
  );
  assert.deepEqual(warnings, []);
  assert.equal(tool.name, "Demo");
  assert.equal(tool.description, "A demo guide");
  assert.deepEqual(tool.sections[0].entries[0], { keys: "w", marks: ["N", "V"], desc: "Next word", example: "w jumps forward", tags: ["move", "word"] });
  assert.deepEqual(tool.sections[0].entries[1], { keys: "plain", marks: [], desc: "Plain entry", tags: [] });
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

test("a line without ' | ' falls back to splitting on any pipe", () => {
  const { tool, warnings } = parseGuide("## S\nkey| does something|example|#tag\n", "x");
  assert.deepEqual(warnings, []);
  assert.deepEqual(tool.sections[0].entries[0], { keys: "key", marks: [], desc: "does something", example: "example", tags: ["tag"] });
});

test("an extra field that looks like tags explains the tag syntax", () => {
  const { warnings } = parseGuide("## S\nk | d | ex | # nope\n", "x", "x.txt");
  assert.match(warnings[0], /^x\.txt:2 extra field ignored \(tags are written #word/);
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

test("marks can be any single letters", () => {
  const { tool, warnings } = parseGuide("## S\n[T P] ctrl-b c | New window\n[x] k | d\n", "tmux");
  assert.deepEqual(warnings, []);
  assert.deepEqual(tool.sections[0].entries[0].marks, ["T", "P"]);
  assert.deepEqual(tool.sections[0].entries[1].marks, ["x"]);
});

test("a bracketed word in the keys is not mistaken for marks", () => {
  const { tool } = parseGuide("## S\n[count] G | Go to line\n", "x");
  assert.equal(tool.sections[0].entries[0].keys, "[count] G");
  assert.deepEqual(tool.sections[0].entries[0].marks, []);
});

test("@legend names the letters; bad definitions warn", () => {
  const { tool, warnings } = parseGuide("# T\n@legend T=Tab, P=Pane mode, oops\n## S\n[T] k | d\n", "t", "t.txt");
  assert.deepEqual(tool.legend, { T: "Tab", P: "Pane mode" });
  assert.match(warnings[0], /^t\.txt:2 bad legend definition 'oops'/);
});

test("the legend lists only used, named marks for the selected guide", () => {
  const a = parseGuide("@legend N=Normal, V=Visual, X=Unused\n## S\n[N V] k | d\n[Z] z | no name\n", "a").tool;
  const b = parseGuide("@legend N=Nav\n## S\n[N] k | d\n", "b").tool;
  assert.deepEqual(legendFor([a, b], "a"), [{ mark: "N", label: "Normal" }, { mark: "V", label: "Visual" }]);
  assert.deepEqual(legendFor([a, b], "b"), [{ mark: "N", label: "Nav" }]);
  assert.deepEqual(legendFor([a, b], ""), [{ mark: "N", label: "Normal / Nav" }, { mark: "V", label: "Visual" }]);
});

test("markColor keeps N/I/V/C fixed and is stable for other letters", () => {
  assert.equal(markColor("N"), "#a6e3a1");
  assert.equal(markColor("T"), markColor("T"));
  assert.match(markColor("T"), /^#[0-9a-f]{6}$/);
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
