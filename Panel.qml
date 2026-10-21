pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "QrgSearch.js" as QrgSearch

// Search panel for the generated qrg.json: type to filter, Tab cycles guides,
// Up/Down move, Enter copies the entry's keys. All lookup logic is in
// QrgSearch.js; this file is only presentation and input.
Panel {
  id: root
  moduleName: "jcmarin.qrg"
  ipcTarget: "jcmarin.qrg"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root

  readonly property color fg: bar ? bar.foreground : Color.foreground
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property color selectedBg: Util.alpha(fg, 0.1)
  readonly property var modeColors: ({ N: "#a6e3a1", I: "#ffca55", V: "#ff9e64", C: "#25ffdb" })

  property var tools: []
  property var warnings: []       // problems found while parsing guide files
  readonly property string bundledDir: Qt.resolvedUrl("guides").toString().replace("file://", "")
  readonly property string userDir: (Quickshell.env("XDG_CONFIG_HOME") || (Quickshell.env("HOME") + "/.config")) + "/qrg/guides"
  property var rows: []
  property var results: []
  property var display: []        // results with section header rows interleaved
  readonly property var titleColors: ["#ff6f96", "#a6e3a1", "#ffca55", "#ff9e64", "#25ffdb", "#cba6f7"]
  property string filterText: ""
  property string toolId: ""      // "" = all guides
  property int selectedIndex: 0

  readonly property var tabs: [{ id: "", name: "All" }].concat(tools.map(function(t) { return { id: t.id, name: t.name } }))

  function rebuild() {
    results = QrgSearch.filter(rows, filterText, toolId, 300)
    var out = [], last = null, n = 0, stripe = 0
    for (var i = 0; i < results.length; i++) {
      var r = results[i]
      var group = toolId ? r.section : r.tool + " · " + r.section
      if (group !== last) {
        out.push({ header: true, title: group, color: titleColors[n++ % titleColors.length] })
        last = group
        stripe = 0
      }
      out.push({ keys: r.keys, desc: r.desc, example: r.example, modes: r.modes, stripe: stripe++ % 2 === 1 })
    }
    display = out
    selectedIndex = out.length > 0 ? 1 : 0   // first entry sits right after the first header
    // Deferred so it runs after the ListView has taken the new model.
    Qt.callLater(function() { list.positionViewAtBeginning() })
  }

  function setFilter(text) { filterText = text; selectedIndex = 0; rebuild() }
  function setTool(id) { toolId = id; selectedIndex = 0; rebuild() }

  function cycleTool(dir) {
    var idx = 0
    for (var i = 0; i < tabs.length; i++) if (tabs[i].id === toolId) idx = i
    setTool(tabs[(idx + dir + tabs.length) % tabs.length].id)
  }

  // Moves the cursor over entries only, skipping section headers.
  function move(delta) {
    var n = display.length
    if (n === 0) return
    var dir = delta < 0 ? -1 : 1
    var i = selectedIndex
    for (var step = 0; step < Math.abs(delta); step++) {
      for (var k = 0; k < n; k++) {
        i = (i + dir + n) % n
        if (!display[i].header) break
      }
    }
    selectedIndex = i
    // Show the section title above the first entry of a section when scrolling up to it.
    list.positionViewAtIndex(display[i - 1] && display[i - 1].header ? i - 1 : i, ListView.Contain)
  }

  function copy(index) {
    if (index < 0 || index >= display.length || display[index].header) return
    Quickshell.execDetached(["sh", "-c", "printf '%s' \"$1\" | wl-copy", "sh", display[index].keys])
    close()
  }

  function reloadGuides() {
    if (!loader.running) loader.running = true
  }

  function applyGuides(text) {
    var res = QrgSearch.parseBundle(text)
    tools = res.tools
    warnings = res.warnings
    rows = QrgSearch.flatten(tools)
    if (toolId && !tools.some(function(t) { return t.id === toolId })) toolId = ""
    rebuild()
  }

  // Creates ~/.config/qrg/guides/<name>.txt from a template (unless it exists) and opens it in the editor.
  function newGuide(name) {
    var id = String(name || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
    if (!id) return
    var title = id.charAt(0).toUpperCase() + id.slice(1)
    Quickshell.execDetached(["sh", "-c",
      'mkdir -p "$1" && { [ -e "$2" ] || printf "# %s\\nShort description\\n\\n## Section\\nkeys | what it does | optional example | #tag\\n// Lines starting with // are comments. Put [N V] before the keys to show modes.\\n" "$3" > "$2"; }; omarchy-launch-editor "$2"',
      "sh", userDir, userDir + "/" + id + ".txt", title])
  }

  onOpenedChanged: if (opened) { filterText = ""; selectedIndex = 0; reloadGuides(); rebuild() }
  Component.onCompleted: reloadGuides()

  // Bundled guides first, then the user's: a user file with the same name replaces the bundled guide.
  Process {
    id: loader
    command: ["sh", "-c",
      'for f in "$1"/*.txt "$2"/*.txt; do [ -f "$f" ] && { printf "\\n@@FILE %s\\n" "$f"; cat "$f"; }; done',
      "sh", root.bundledDir, root.userDir]
    stdout: StdioCollector { id: loaderOut; waitForEnd: true }
    onExited: root.applyGuides(loaderOut.text)
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(620))
    contentHeight: panel.fittedContentHeight(Style.space(640))

    Item {
      id: keyCatcher
      anchors.fill: parent
      focus: true

      Keys.priority: Keys.BeforeItem
      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape) {
          if (root.filterText) root.setFilter("")
          else root.close()
        } else if (Util.editsFilter(event, root.filterText)) {
          root.setFilter(Util.editedFilter(event, root.filterText))
        } else if (event.key === Qt.Key_Tab) {
          root.cycleTool(1)
        } else if (event.key === Qt.Key_Backtab) {
          root.cycleTool(-1)
        } else if (event.key === Qt.Key_Down) {
          root.move(1)
        } else if (event.key === Qt.Key_Up) {
          root.move(-1)
        } else if (event.key === Qt.Key_PageDown) {
          root.move(8)
        } else if (event.key === Qt.Key_PageUp) {
          root.move(-8)
        } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
          root.copy(root.selectedIndex)
        } else if (event.text && event.text.length === 1 && event.text.charCodeAt(0) >= 32 && event.text.charCodeAt(0) !== 127) {
          root.setFilter(root.filterText + event.text)
        } else {
          return
        }
        event.accepted = true
      }
    }

    Column {
      anchors.fill: parent
      spacing: Style.space(8)

      Text {
        width: parent.width
        textFormat: Text.PlainText
        text: root.filterText || "Search guides…"
        color: root.fg
        opacity: root.filterText ? 1 : 0.58
        font.family: root.fontFamily
        font.pixelSize: Style.font.heading
        elide: Text.ElideRight
      }

      Flow {
        width: parent.width
        spacing: Style.space(6)

        Repeater {
          model: root.tabs
          delegate: Rectangle {
            id: chip
            required property var modelData
            readonly property bool active: modelData.id === root.toolId

            width: chipLabel.implicitWidth + Style.space(16)
            height: chipLabel.implicitHeight + Style.space(6)
            radius: height / 2
            color: active ? Color.accent : "transparent"
            border.width: 1
            border.color: active ? Color.accent : Util.alpha(root.fg, 0.3)

            Text {
              id: chipLabel
              anchors.centerIn: parent
              text: chip.modelData.name
              color: chip.active ? Color.background : root.fg
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              font.bold: chip.active
            }

            MouseArea {
              anchors.fill: parent
              cursorShape: Qt.PointingHandCursor
              onClicked: root.setTool(chip.modelData.id)
            }
          }
        }
      }

      Text {
        visible: root.warnings.length > 0
        width: parent.width
        text: "\u26a0 " + (root.warnings[0] || "") + (root.warnings.length > 1 ? "  (+" + (root.warnings.length - 1) + " more)" : "")
        textFormat: Text.PlainText
        color: Color.urgent
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        elide: Text.ElideRight
      }

      ListView {
        id: list
        width: parent.width
        height: parent.height - y
        clip: true
        model: root.display
        boundsBehavior: Flickable.StopAtBounds

        delegate: Rectangle {
          id: row
          required property int index
          required property var modelData
          readonly property bool isHeader: modelData.header === true
          property bool tipReady: false   // set by hoverTimer so the tooltip really waits
          readonly property bool current: !isHeader && index === root.selectedIndex

          width: ListView.view.width
          height: isHeader ? headerText.implicitHeight + Style.space(14) : rowColumn.implicitHeight + Style.space(10)
          radius: Style.cornerRadius
          color: current ? root.selectedBg : (!isHeader && modelData.stripe ? Util.alpha(root.fg, 0.045) : "transparent")

          Text {
            id: headerText
            visible: row.isHeader
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.leftMargin: Style.space(8)
            anchors.bottomMargin: Style.space(3)
            text: row.isHeader ? row.modelData.title.toUpperCase() : ""
            textFormat: Text.PlainText
            color: row.isHeader ? row.modelData.color : root.fg
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            font.letterSpacing: 1
            elide: Text.ElideRight
          }

          Column {
            id: rowColumn
            visible: !row.isHeader
            anchors.verticalCenter: parent.verticalCenter
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.margins: Style.space(8)
            spacing: Style.space(2)

            Row {
              width: parent.width
              spacing: Style.space(10)

              Text {
                id: keysText
                width: Math.min(implicitWidth, parent.width * 0.5)
                text: row.isHeader ? "" : row.modelData.keys
                textFormat: Text.PlainText
                color: Color.accent
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
                elide: Text.ElideRight
              }

              Text {
                width: parent.width - keysText.width - modeRow.width - parent.spacing * 2
                text: row.isHeader ? "" : row.modelData.desc
                textFormat: Text.PlainText
                color: root.fg
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
                elide: Text.ElideRight
              }

              Row {
                id: modeRow
                spacing: Style.space(3)

                Repeater {
                  model: row.isHeader ? [] : row.modelData.modes
                  delegate: Rectangle {
                    required property string modelData
                    width: Style.space(16)
                    height: Style.space(16)
                    radius: Style.space(3)
                    color: root.modeColors[modelData] || root.fg

                    Text {
                      anchors.centerIn: parent
                      text: parent.modelData
                      color: Color.background
                      font.family: root.fontFamily
                      font.pixelSize: Style.font.caption
                      font.bold: true
                    }
                  }
                }
              }
            }
          }

          MouseArea {
            id: rowMouse
            anchors.fill: parent
            enabled: !row.isHeader
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onContainsMouseChanged: {
              if (containsMouse) root.selectedIndex = row.index
              else row.tipReady = false
            }
            onClicked: root.copy(row.index)
          }

          Timer {
            id: hoverTimer
            interval: 600
            running: rowMouse.containsMouse
            onTriggered: row.tipReady = true
          }

          // Only the extra text shows: the example, or the full keys when they are elided and there is no example.
          PanelToolTip {
            visible: row.tipReady && rowMouse.containsMouse && !row.isHeader && (row.modelData.example !== "" || keysText.truncated)
            delay: 0
            text: row.isHeader ? "" : (row.modelData.example !== "" ? row.modelData.example : row.modelData.keys)
            fontFamily: root.fontFamily
          }
        }
      }
    }
  }
}
