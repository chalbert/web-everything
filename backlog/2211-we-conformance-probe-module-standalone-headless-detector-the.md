---
kind: story
size: 3
parent: "1753"
locus: plateau-app
status: open
dateOpened: "2026-07-03"
tags: []
---

# WE-conformance probe module — standalone headless detector the dev-browser shell imports

Author a standalone plateau:src/dev-browser/shell/probe/ module: detect(doc, win) -> {conformant, level, signals} reading the script[type=registry] DOM marker (frontierui:plugs/webregistries/declarativeRegistry.ts) plus optional window.__WE_DEVTOOLS_GLOBAL_HOOK__. No Electron, fully unit-tested. #1753 stays open for the windowed boot that imports this.
