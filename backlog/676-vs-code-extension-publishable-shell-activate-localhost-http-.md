---
type: issue
workItem: task
status: open
blockedBy: ["577"]
dateOpened: "2026-06-15"
locus: plateau-app
tags: [dev-browser, ide-bridge, vscode-extension, packaging, plateau-app]
---

# VS Code extension publishable shell — activate() + localhost HTTP/WS server + URI handler

Package the #577 testable spine as an installable VS Code extension: an activate() that stands up a localhost HTTP/WS server piping each frame through createBridgeHandler(createVscodeHost(vscode, version)), plus registerUriHandler for vscode://publisher.ext/… routing, and the extension manifest (engines.vscode, contributes). This is the only part that needs a real extension host to run — the protocol, browser provider, handler core, and live-API adapter already ship in plateau-app/src/dev-browser/ide-bridge/vscode-extension/. Verify end-to-end against a running dev-browser tab.
