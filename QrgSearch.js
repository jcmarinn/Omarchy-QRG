// Pure helpers shared by Panel.qml (and the web page build): parse guide text
// files and filter their entries. No QML or Node APIs are used here.
//
// Guide file format (guides/<id>.txt):
//   # Name                       guide title (the id is the file name)
//   One-line description         optional, before the first section
//   ## Section title
//   [N V] keys | description | example | #tag #tag     (spaces around each |)
//   // comment
// Only keys and description are required; "[N V]" lists modes (N I V C) and a
// field made only of #words is read as tags.

var MODES = ["N", "I", "V", "C"]

function titleCase(id) {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

// Parses one guide file. Returns { tool, warnings } where tool is null when the
// file has no usable entries.
function parseGuide(text, id, file) {
  var warnings = []
  var where = file || id
  function warn(n, msg) { warnings.push(where + ":" + n + " " + msg) }

  var tool = { id: id, name: titleCase(id), sections: [] }
  var section = null
  var lines = String(text || "").split(/\r?\n/)

  for (var i = 0; i < lines.length; i++) {
    var n = i + 1
    var line = lines[i].replace(/\s+$/, "")
    if (!line.trim() || /^\s*\/\//.test(line)) continue

    var m
    if ((m = /^##\s+(.+)$/.exec(line))) {
      section = { name: m[1].trim(), entries: [] }
      tool.sections.push(section)
      continue
    }
    if ((m = /^#\s+(.+)$/.exec(line))) {
      tool.name = m[1].trim()
      continue
    }
    if (!section) {
      if (!tool.description) tool.description = line.trim()
      else warn(n, "text outside a section was ignored")
      continue
    }

    var modes = []
    var body = line.trim()
    if ((m = /^\[([NIVC ,]+)\]\s+(.*)$/.exec(body))) {
      modes = m[1].split(/[\s,]+/).filter(function(x) { return x })
      body = m[2]
    }
    // " | " (spaces around the pipe) is the separator, so keys may contain a bare "|".
    // A line with no such separator falls back to splitting on any "|".
    var f = body.split(" | ")
    if (f.length < 2) f = body.split("|")
    f = f.map(function(x) { return x.trim() })
    if (f.length < 2 || !f[0] || !f[1]) {
      warn(n, "needs 'keys | description' (a | between them)")
      continue
    }
    var entry = { keys: f[0], mode: modes, desc: f[1], tags: [] }
    for (var k = 2; k < f.length; k++) {
      if (!f[k]) continue
      if (/^#\S+(\s+#\S+)*$/.test(f[k])) entry.tags = f[k].split(/\s+/).map(function(t) { return t.slice(1) })
      else if (entry.example === undefined) entry.example = f[k]
      else warn(n, "extra field ignored" + (f[k].charAt(0) === "#" ? " (tags are written #word #word, no space after #)" : ""))
    }
    section.entries.push(entry)
  }

  tool.sections = tool.sections.filter(function(s) { return s.entries.length > 0 })
  if (tool.sections.length === 0) {
    warnings.push(where + " has no entries and was skipped")
    return { tool: null, warnings: warnings }
  }
  return { tool: tool, warnings: warnings }
}

// Parses the concatenated output of the loader script: each file is introduced
// by a "@@FILE <path>" line. A later file with the same id (the user's) replaces
// an earlier one (the bundled one).
function parseBundle(raw) {
  var tools = [], warnings = []
  var parts = String(raw || "").split(/^@@FILE (.*)$/m)
  for (var i = 1; i < parts.length; i += 2) {
    var path = parts[i]
    var file = path.split("/").pop()
    var id = file.replace(/\.[^.]*$/, "").toLowerCase()
    // Drop the newline that ends the "@@FILE" line so reported line numbers match the file.
    var res = parseGuide(parts[i + 1].replace(/^\r?\n/, ""), id, file)
    warnings = warnings.concat(res.warnings)
    if (!res.tool) continue
    var at = -1
    for (var j = 0; j < tools.length; j++) if (tools[j].id === id) at = j
    if (at >= 0) tools[at] = res.tool
    else tools.push(res.tool)
  }
  tools.sort(function(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0 })
  return { tools: tools, warnings: warnings }
}

function flatten(tools) {
  var rows = []
  for (var i = 0; i < tools.length; i++) {
    var t = tools[i]
    for (var j = 0; j < t.sections.length; j++) {
      var s = t.sections[j]
      for (var k = 0; k < s.entries.length; k++) {
        var e = s.entries[k]
        rows.push({
          toolId: t.id,
          tool: t.name,
          section: s.name,
          keys: e.keys,
          desc: e.desc,
          example: e.example || "",
          modes: e.mode || [],
          hay: [t.name, s.name, e.keys, e.desc, e.example || "", (e.tags || []).join(" "), (e.mode || []).join(" ")].join(" ").toLowerCase()
        })
      }
    }
  }
  return rows
}

// Every whitespace-separated term must appear somewhere in the row.
function filter(rows, query, toolId, limit) {
  var terms = String(query || "").trim().toLowerCase().split(/\s+/).filter(function(t) { return t })
  var out = []
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]
    if (toolId && r.toolId !== toolId) continue
    var ok = true
    for (var t = 0; t < terms.length; t++) {
      if (r.hay.indexOf(terms[t]) < 0) { ok = false; break }
    }
    if (ok) {
      out.push(r)
      if (out.length >= limit) break
    }
  }
  return out
}

if (typeof module !== "undefined") {
  module.exports = { MODES: MODES, parseGuide: parseGuide, parseBundle: parseBundle, flatten: flatten, filter: filter }
}
