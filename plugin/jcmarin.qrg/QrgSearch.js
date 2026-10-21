// Pure helpers shared by Panel.qml: flatten qrg.json into rows and filter them.

function parse(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    return data && Array.isArray(data.tools) ? data.tools : []
  } catch (e) {
    return []
  }
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
  module.exports = { parse: parse, flatten: flatten, filter: filter }
}
