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
  property var rows: []
  property var results: []
  property var display: []        // results with section header rows interleaved
  readonly property var titleColors: ["#5596ff", "#a6e3a1", "#ffca55", "#ff9e64", "#25ffdb", "#cba6f7"]
  property string filterText: ""
  property string toolId: ""      // "" = all guides
  property int selectedIndex: 0

  readonly property var tabs: [{ id: "", name: "All" }].concat(tools.map(function(t) { return { id: t.id, name: t.name } }))

  function rebuild() {
    results = QrgSearch.filter(rows, filterText, toolId, 300)
    var out = [], last = null, n = 0
    for (var i = 0; i < results.length; i++) {
      var r = results[i]
      var group = toolId ? r.section : r.tool + " · " + r.section
      if (group !== last) {
        out.push({ header: true, title: group, color: titleColors[n++ % titleColors.length] })
        last = group
      }
      out.push(r)
    }
    display = out
    selectedIndex = out.length > 0 ? 1 : 0   // first entry sits right after the first header
    list.positionViewAtIndex(0, ListView.Beginning)
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

  onOpenedChanged: if (opened) { filterText = ""; selectedIndex = 0; rebuild() }

  FileView {
    path: Qt.resolvedUrl("qrg.json").toString().replace("file://", "")
    watchChanges: true
    onFileChanged: reload()
    onLoaded: {
      root.tools = QrgSearch.parse(text())
      root.rows = QrgSearch.flatten(root.tools)
      root.rebuild()
    }
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
          readonly property bool current: !isHeader && index === root.selectedIndex

          width: ListView.view.width
          height: isHeader ? headerText.implicitHeight + Style.space(14) : rowColumn.implicitHeight + Style.space(10)
          radius: Style.cornerRadius
          color: current ? root.selectedBg : "transparent"

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

            Text {
              visible: row.current && row.modelData.example !== ""
              width: parent.width
              text: row.isHeader ? "" : row.modelData.example
              textFormat: Text.PlainText
              color: root.fg
              opacity: 0.65
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              wrapMode: Text.WordWrap
            }
          }

          MouseArea {
            anchors.fill: parent
            enabled: !row.isHeader
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onContainsMouseChanged: if (containsMouse) root.selectedIndex = row.index
            onClicked: root.copy(row.index)
          }
        }
      }
    }
  }
}
