---
kind: story
size: 3
parent: "1656"
locus: plateau-app
status: open
blockedBy: ["1671"]
dateOpened: "2026-06-23"
tags: [dev-browser, ide-bridge, chrome-extension, plateau]
---

# IDE-bridge transport adapter over chrome.runtime for the dev-browser extension

The dev-browser funnel-MVP's first real tool (#1656 S2): carry the existing transport-agnostic BridgeRequest/BridgeResponse frames (#577/#676) panel→service-worker→host over chrome.runtime.sendMessage, reusing the built protocol at plateau:src/dev-browser/ide-bridge/vscode-extension/protocol.ts. Jump-only — transport plumbing for the existing jump(location) call, NOT the #1652 element-resolver. blockedBy the #1671 scaffold. Demoable: from the panel, a jump opens the file in VS Code via the existing host server.
