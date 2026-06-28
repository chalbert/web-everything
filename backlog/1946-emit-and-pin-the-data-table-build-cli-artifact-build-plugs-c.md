---
kind: story
size: 2
parent: "1600"
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
tags: []
---

# Emit and pin the data-table build-CLI artifact (build:plugs compiles tools/, resolvable locked path)

Slice A (#1902) shipped fui:tools/data-table-build/cli.ts but FUI tsconfig include is [plugs,blocks,adapters,config] — tools/ is NOT compiled, so build:plugs emits no compiled cli and fui:dist/tools is absent. Slice C (#1905) is specified to shell to a LOCKED compiled build-artifact (never PATH-resolved); that artifact does not exist. Add tools/data-table-build to the FUI build (tsc include or a dedicated emit) so the cli compiles to a resolvable pinned path, and define how WE resolves+invokes it across the repo boundary (build ordering: FUI emit before WE eleventy build). Unblocks #1905. Locus frontierui.
