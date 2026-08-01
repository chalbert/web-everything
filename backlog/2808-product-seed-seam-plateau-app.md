---
bornAs: xwz1uoy
kind: story
size: 5
parent: "2804"
status: resolved
dateOpened: "2026-08-01"
dateResolved: "2026-08-01"
tags: [plateau-loop, conveyor, ui-fidelity, plateau-app, slice-uifg]
---

# Product seed seam (plateau-app)

A data-injection point in plateau-app that seeds the REAL data store the live route reads (empty / populated / overflow regimes) — not a demo param or a bypass seam. Product render-side; WE holds zero impl.

## Delivered

Built the seed seam in **plateau-app** (WE holds zero impl — this lands in the plateau-app repo). The live
`/console-board` route reads its board entirely from one repo root: the backlog markdown files (via
`loadBacklog` → items/status) plus the batch-loop claims/queued JSON state (via `loadOverlay` → which items
are in-flight and in which lane). The seam seeds exactly those files — the SAME store the route reads — so
seeded data flows through the unchanged `loadBacklog` → `loadOverlay` → `buildBoard` → `mountLaneBoard` path.
No `?demo=` param, no render bypass.

- **plateau-app:src/backlog-view/board-seed.ts** — `seedBoardStore(root, seed)` writes a regime's fixture into
  the target root's backlog markdown files plus the claims/queued loop-state JSON; `applyBoardSeed(...)`
  (driven by the `PLATEAU_BOARD_SEED` env var) re-points the repo registry's default slug at a freshly-seeded
  temp store, a no-op when the env var is unset. `boardSeedActive()` gates the overlay handler's live `gh`
  PR-join off so the seeded overlay stays pure (the `empty` regime keeps zero lanes).
- **plateau-app:tests/fixtures/board-seeds.ts** — the three regimes: `empty`, `populated`, `overflow`.
- **plateau-app:vite.config.mts** — the `scopeLease` + `backlogApi` dev plugins call `applyBoardSeed`, and the
  overlay handler skips live PRs when seeded, so running the dev server with `PLATEAU_BOARD_SEED=overflow`
  makes the live browser route at `/console-board` render the seeded data.

**Verified** — `npx vitest run plateau-app:src/backlog-view/board-seed.test.ts` in the plateau-app clone (5/5
green; the full plateau-app:src/backlog-view suite is 671/671 green). Seeding through the seam and then driving
the real route data path (`loadBacklog`+`loadOverlay`+`buildBoard`+`mountLaneBoard`) renders — EMPTY → the
"No lanes in flight" empty state (zero lane columns); POPULATED → the seeded lanes render as live columns with
the seeded cards; OVERFLOW → ten distinct claiming sessions → ten lanes, and `computeCapacity(10, 900) < 10`,
the high-cardinality regime that collapses the multi-lane grid to strips.
