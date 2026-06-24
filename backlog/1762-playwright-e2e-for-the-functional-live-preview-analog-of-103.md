---
kind: task
parent: "912"
status: open
blockedBy: ["1761"]
dateOpened: "2026-06-24"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot, functional-adapter, e2e]
---

# Playwright e2e for the functional live-preview (analog of #1031)

The functional analog of #1031 (the wrapper live-test e2e). A Playwright spec that, on the running second origin, cross-origin-imports the #1760 functional-live module, calls mount() into the stage, and asserts: the functional form renders, unmount() tears down cleanly, and a thrown error surfaces via the ErrorBoundary + window.onerror path. Closes the #1746-GO realization chain with a live in-browser arbiter (the same standard the wrapper path used to call its mechanism proven).
