import QtQuick
import Quickshell.Io
import qs.Commons
import qs.Ui

BarWidget {
    id: root
    moduleName: "jcmarin.qrg"

    // Same popout-identity contract as the omaplug widget: the bar compares
    // against this widget, not the nested panel.
    readonly property bool opened: panelItem ? panelItem.opened === true : false

    function open() { if (panelItem) panelItem.open() }
    function close() { if (panelItem) panelItem.close() }
    function togglePanel() { if (panelItem) panelItem.toggle() }

    readonly property bool popoutSwitchClosing: panelItem ? panelItem.popoutSwitchClosing === true : false
    function closeForPopoutSwitch() { if (panelItem) panelItem.closeForPopoutSwitch() }

    property var panelItem: null

    function injectPanel() {
        var target = panelLoader.item
        if (!target) return
        panelItem = target
        if ("bar" in target) target.bar = root.bar
        if ("settings" in target) target.settings = root.settings
        if ("anchorItem" in target) target.anchorItem = button
        if ("hostWidget" in target) target.hostWidget = root
    }

    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight

    onBarChanged: injectPanel()
    onSettingsChanged: injectPanel()

    Loader {
        id: panelLoader
        active: true
        source: Qt.resolvedUrl("Panel.qml")
        visible: false
        onLoaded: {
            root.injectPanel()
            Qt.callLater(root.injectPanel)
        }
    }

    // omarchy-shell ipc: `qrg toggle|open|close` (bind to a key in Hyprland).
    IpcHandler {
        target: "qrg"

        function open(): void { root.open() }
        function close(): void { root.close() }
        function show(): void { root.open() }
        function hide(): void { root.close() }
        function toggle(): void { root.togglePanel() }
        // `omarchy-shell qrg newGuide <name>` scaffolds ~/.config/qrg/guides/<name>.txt and opens it.
        function newGuide(name: string): void { if (root.panelItem) root.panelItem.newGuide(name) }
    }

    BarIconButton {
        id: button
        anchors.fill: parent
        bar: root.bar
        text: ""
        tooltipText: "Quick Reference Guide"

        onPressed: function(b) {
            if (b === Qt.LeftButton) root.togglePanel()
        }
    }
}
