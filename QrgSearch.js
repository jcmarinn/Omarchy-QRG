// Pure helpers shared by Panel.qml (and the web page build): parse guide text
// files and filter their entries. No QML or Node APIs are used here.
//
// Guide file format (guides/<id>.txt):
//   # Name                       guide title (the id is the file name)
//   One-line description         optional, before the first section
//   @legend N=Normal, I=Insert   optional: names for the mark letters used below
//   ## Section title
//   [N V] keys | description | example | #tag #tag     (spaces around each |)
//   // comment
// Only keys and description are required; "[N V]" puts marks (badges) on an
// entry — any single letters, e.g. editor modes or tmux panes; "@legend" names
// them for the legend — and a field made only of
// #words is read as tags.

// Marks N/I/V/C keep fixed colors; any other letter gets one from the palette.
var MARK_COLORS = { N: "#a6e3a1", I: "#ffca55", V: "#ff9e64", C: "#25ffdb" }
var MARK_PALETTE = ["#ff6f96", "#cba6f7", "#89b4fa", "#f9e2af", "#94e2d5", "#fab387", "#f5c2e7", "#b4befe"]

function markColor(letter) {
  if (MARK_COLORS[letter]) return MARK_COLORS[letter]
  return MARK_PALETTE[String(letter).charCodeAt(0) % MARK_PALETTE.length]
}

function titleCase(id) {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

// Parses one guide file. Returns { tool, warnings } where tool is null when the
// file has no usable entries.
function parseGuide(text, id, file) {
  var warnings = []
  var where = file || id
  function warn(n, msg) { warnings.push(where + ":" + n + " " + msg) }

  var tool = { id: id, name: titleCase(id), legend: {}, sections: [] }
  var section = null
  var lines = String(text || "").split(/\r?\n/)

  for (var i = 0; i < lines.length; i++) {
    var n = i + 1
    var line = lines[i].replace(/\s+$/, "")
    if (!line.trim() || /^\s*\/\//.test(line)) continue

    var m
    if ((m = /^@legend\s+(.+)$/.exec(line.trim()))) {
      m[1].split(",").forEach(function(def) {
        if (!def.trim()) return
        var p = /^\s*([A-Za-z])\s*=\s*(.+?)\s*$/.exec(def)
        if (p) tool.legend[p[1]] = p[2]
        else warn(n, "bad legend definition '" + def.trim() + "' (use X=Name, Y=Name)")
      })
      continue
    }
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

    var marks = []
    var body = line.trim()
    // "[N V] keys": every token must be a single letter, so keys like "[count]" are left alone.
    if ((m = /^\[([A-Za-z ,]+)\]\s+(.*)$/.exec(body))) {
      var letters = m[1].split(/[\s,]+/).filter(function(x) { return x })
      if (letters.length && letters.every(function(x) { return x.length === 1 })) {
        marks = letters
        body = m[2]
      }
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
    var entry = { keys: f[0], marks: marks, desc: f[1], tags: [] }
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

// Legend for one guide: the marks actually used by its entries that it named
// with "@legend". Unnamed marks only appear as badges, not in the legend. There
// is no legend without a selected guide, since a letter can mean different
// things in different guides.
function legendFor(tools, toolId) {
  if (!toolId) return []
  var scope = tools.filter(function(t) { return t.id === toolId })
  var used = {}
  scope.forEach(function(t) {
    t.sections.forEach(function(s) {
      s.entries.forEach(function(e) { e.marks.forEach(function(m) { used[m] = true }) })
    })
  })
  var order = [], names = {}
  scope.forEach(function(t) {
    Object.keys(t.legend || {}).forEach(function(m) {
      if (!used[m]) return
      if (!names[m]) { names[m] = []; order.push(m) }
      if (names[m].indexOf(t.legend[m]) < 0) names[m].push(t.legend[m])
    })
  })
  return order.map(function(m) { return { mark: m, label: names[m].join(" / ") } })
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
          marks: e.marks || [],
          hay: [t.name, s.name, e.keys, e.desc, e.example || "", (e.tags || []).join(" "), (e.marks || []).join(" ")].join(" ").toLowerCase()
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
  module.exports = { markColor: markColor, parseGuide: parseGuide, parseBundle: parseBundle, legendFor: legendFor, flatten: flatten, filter: filter }
}
