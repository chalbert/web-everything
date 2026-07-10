---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "fui:compiler/src/component-transform/index.ts"
tags: []
---

# Workbench demo entry breaks in browser — node:fs/promises externalized (blocks live-test demo view)

The FUI workbench demo entry (fui:demos/workbench.html) throws 'Module node:fs/promises has been externalized for browser compatibility' and never reaches workbenchReady — reproduces on main with the stock ?block=auto-complete, so a pre-existing regression, not #1030. A node builtin leaks into the client bundle via the fui:workbench/registry.ts to fui:workbench/authorModeData.ts to fui:blocks/renderers compiler graph (componentAuthorBlocks). Blocks SEEING any block (incl. the #1030 background-tasks-live block) in the live demo; the live-mount code itself is browser-verified via its own path. Fix: cut the node:fs import out of the browser graph (guard/lazy the compiler behind serve-time, or split the author-mode data off the client entry). locus:frontierui.
