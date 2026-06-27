---
kind: story
size: 2
parent: "1836"
status: open
blockedBy: ["1887"]
dateOpened: "2026-06-27"
tags: []
---

# Serve the plug parity data over the cross-origin MaaS data route (FUI)

FUI. Serve the parity manifest (S5a/#1887) over the existing cross-origin MaaS data route — mirror the fui:tools/maas/vite-plugin.mjs:80-88 data-route handler (the existing per-tag JSON route) with a parity data route. This is the cross-origin data path #1839 mandates for the verdict reaching the WE doc-site. Blocked by #1887 (needs the manifest to serve).
