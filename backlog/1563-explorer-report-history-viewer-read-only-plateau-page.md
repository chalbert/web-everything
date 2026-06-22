---
kind: story
size: 5
parent: "1548"
status: resolved
blockedBy: ["1562"]
locus: plateau-app
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# Explorer report-history viewer (read-only plateau page)

A read-only plateau page that lists past explorer runs and renders a selected bundle (rendered report + screenshots) inline, over the bundle store from #1562. Demoable on its own — no trigger needed — and is the read-path half of v1 (A+B browse existing bundles before C adds triggering). Dogfoods FUI components (#1254). Slice B of #1548; blocked by #1562.

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559)

Built the read-path viewer at `/explorer-history`, consuming the #1562 store API:

- **`plateau:src/explorer-history/explorer-history.ts`** (+ `.css`) — `mountExplorerHistory(el)`: fetches the
  run index (`GET /api/explorer/runs`), renders a run rail, and on selection fetches the run's findings
  JSON + renders the bundle inline (findings table, screenshots as `<img>` served from the
  files endpoint, a link to the raw report). Read-only; empty/loading/error states handled. The data→HTML
  contract is in exported pure helpers `renderRunList` / `renderBundle` (origin-agnostic via an injected
  `fileUrl`).
- **Route wired** — nav-item + a `route="/explorer-history"` template in `plateau:index.html`; import +
  `PRODUCT_ROUTES` + breadcrumb label + route-change dispatch + a robust-timing `tryMountExplorerHistory()`
  in `plateau:src/main.ts` (mirrors the other page mounts).

**Tests/verification:** `plateau:src/explorer-history/explorer-history.test.ts` — 6 tests over the render
helpers (empty state, row-per-run + selection marker, hostile-url escaping, findings table, screenshot
`<img>` wiring, failed-run error path). Full suite **279 pass**. Live on :4000 (logged in → nav to the page):
renders "Explorer Run History" + the empty-state rail, **no console errors**. The write-path (trigger a run
from the UI = slice C) and richer report rendering ride on #1548. (A pre-existing `updateUserDisplay` type
error in `plateau:src/main.ts` is unrelated to this change; plateau's gate is `npm test`, green.)
