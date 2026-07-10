---
kind: task
parent: "912"
status: resolved
blockedBy: ["1030"]
dateOpened: "2026-06-19"
dateStarted: "2026-07-09"
dateResolved: "2026-07-10"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, e2e, polyglot]
---

# Playwright e2e for the polyglot live-test panel

Reuse the vendored runtime (no uncontrolled external network): mount a block's react-wrapper in the workbench live-test panel, assert it renders and that a thrown error surfaces in the error panel.
