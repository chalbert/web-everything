---
kind: decision
status: open
locus: plateau-app
dateOpened: "2026-06-23"
relatedReport: reports/2026-06-22-1391-split-analysis.md
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 Fork 4-A (panel embed seam)" }
tags: [dev-browser, plateau, panel-embed, decision]
---

# Dev-browser panel-embed boundary — package import vs iframe/web-component mount for plateau-app panels (#141 Fork 4-A)

Resolve #141 Fork 4-A: how the dev-browser shell mounts plateau-app's technical-configurator / intent-configurator / profiles panels — direct package import vs iframe/web-component boundary. Unblocks slicing #1391 (the panel-embed slice currently buries this fork).
