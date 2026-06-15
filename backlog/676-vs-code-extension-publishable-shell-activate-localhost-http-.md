---
type: issue
workItem: task
status: open
blockedBy: ["577", "685"]
dateOpened: "2026-06-15"
locus: plateau-app
tags: [dev-browser, ide-bridge, vscode-extension, packaging, plateau-app]
---

# VS Code extension publishable shell — activate() + localhost HTTP/WS server + URI handler

Package the #577 testable spine as an installable VS Code extension: an activate() that stands up a localhost HTTP/WS server piping each frame through createBridgeHandler(createVscodeHost(vscode, version)), plus registerUriHandler for vscode://publisher.ext/… routing, and the extension manifest (engines.vscode, contributes). This is the only part that needs a real extension host to run — the protocol, browser provider, handler core, and live-API adapter already ship in plateau-app/src/dev-browser/ide-bridge/vscode-extension/. Verify end-to-end against a running dev-browser tab.

**Blocked on its test harness (#685).** plateau-app's `npm test` (Vitest) never loads an extension host, so it cannot run `activate()` / `registerUriHandler` / the manifest. Per the agent-runnable-verification rule (`docs/agent/testing.md`), this end-to-end claim needs the `@vscode/test-electron` Extension-Development-Host harness as a resolved dependency — `blockedBy: ["685"]`. Build the shell against that harness so activation is a reproducible green, not a manual F5.
