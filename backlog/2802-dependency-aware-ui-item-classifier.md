---
bornAs: xf72eqi
kind: story
size: 5
parent: "2804"
status: resolved
dateOpened: "2026-08-01"
dateStarted: "2026-08-01"
dateResolved: "2026-08-01"
tags: [plateau-loop, conveyor, ui-fidelity, we, classifier, slice-uifg]
---

# Dependency-aware UI-item classifier

Widen isVisualTouch from a WE-only path-regex into a general repo-qualified presentation predicate that resolves each real route import graph — a change to any module the route transitively renders through (data mappers/store included) classifies the item as UI-affecting. Closes the data-layer dodge.

## Delivered

**Built:**
- New `we:scripts/lib/route-import-graph.mjs` — a deterministic, WE-side (no product boot) route import-graph resolver:
  - `resolveTransitiveModules(graph, entries)` — cycle-safe transitive closure over a repo-qualified adjacency map.
  - `buildImportGraph({ entries, readModule, resolveSpecifier })` — the REAL resolver interface: walks static/side-effect/re-export/dynamic imports from entry modules via an injected reader (fs-backed for real source, in-memory for tests). `parseImportSpecifiers` extracts the edges.
  - `ROUTE_ENTRIES` registry mapping `/console-board` to its entry modules (view `lane-board` and data layer `lane-board-data`), plus `routeRenderClosure`, `routesAffectedBy`, `isRouteAffectingChange`, and `moduleId`/`parseModuleId` for `repo:path` node ids.
- Widened `isVisualTouch(files, opts)` in `we:scripts/lib/render-check.mjs`: keeps the path-regex (backward-compatible — no `opts` = historical behavior) and folds in the route-graph signal when `opts.routeGraph` is passed. Either mechanism firing classifies the change as UI-affecting.

**Verified** (`npx vitest run` on `we:scripts/lib/__tests__/route-import-graph.test.mjs` + `we:scripts/lib/__tests__/render-check.test.mjs` — 24 passed; `we:scripts/check-standards.mjs` — 0 errors):
- ACCEPTANCE: a change limited to `plateau-app:src/backlog-view/lane-board-data.ts` (the data-layer change class that emptied the console board) classifies as UI-affecting for `/console-board`. A pure path-regex (`isVisualTouch([data])`) returns **false**; the import-graph resolver (`isVisualTouch([data], { routeGraph })`) returns **true**.
- Transitivity proven: a change to `plateau-app:src/backlog-view/card-state-read-model.ts` (imported BY the data layer) is also caught. A module outside every route closure does not fire.
- The fixture graph mirrors the real chain (read from live plateau-app source: `plateau-app:src/main.ts` imports `loadBoardData` from the data module for the `/console-board` mount; the `plateau-app:src/backlog-view/lane-board-data.ts` module imports the read-model, types, card-taxonomy, span types). `buildImportGraph` exercises its real parser + relative-specifier resolver over that fixture.

**Follow-up:** wire `buildImportGraph` to a committed real-graph snapshot of the plateau-app module manifest so the resolver runs against the live import graph inside `check:standards` without the plateau-app sibling checkout present (kept a fixture here to stay WE-side deterministic, per the slice's own guidance).
