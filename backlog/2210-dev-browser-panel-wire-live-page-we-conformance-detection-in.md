---
kind: story
size: 3
parent: "1656"
locus: plateau-app
status: resolved
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
graduatedTo: "plateau:src/dev-browser/chrome-extension/panel.js,plateau:src/dev-browser/chrome-extension/panel-detect.js,plateau:src/dev-browser/chrome-extension/panel.html"
tags: []
---

# Dev-browser panel — wire live-page WE-conformance detection into the extension panel (headless)

Replace the plateau:src/dev-browser/chrome-extension/panel.js 'no detection yet' stub with live-page conformance detection: read the script[type=registry] DOM marker (+ optional __WE_DEVTOOLS_GLOBAL_HOOK__ global) in the inspected page, light the panel status on/off, and register the panel behaviour. Pure DOM read per resolved #1673, jsdom-tested. NOT the Electron shell.
