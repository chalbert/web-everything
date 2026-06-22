---
kind: story
size: 8
parent: "1548"
status: resolved
locus: plateau-app
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# Explorer bundle store + executor endpoint (plateau)

The de-risking foundation for the explorer run-management surface: a plateau dev-server middleware endpoint (mirroring the existing plateau:src/ /api/* mock layer) that shells out to the FUI explorer CLI (fui:tools/explorer/cli.ts -- <url> --auth <recipe> --out <dir>), tracks run status, and persists + indexes + serves each run's --out bundle (rendered report + findings JSON + screenshots). Headless-testable on its own. Slice A of #1548 (itself a future /slice candidate — executor vs store).

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559)

Built the de-risking foundation as a headless core + a thin dev-server shell:

- **`plateau:src/explorer-runs/runStore.ts`** — `RunStore`: fs-backed per-run index (a per-run record JSON
  under the run's own dir is the only thing it writes; the explorer `--out` bundle subtree is read back).
  `create`/`get`/`list` (newest-first, derived by reading each per-run record — no separate index file, per
  the #1145 per-entry pattern)/`update`; ids are timestamp-prefixed + sortable.
- **`plateau:src/explorer-runs/executor.ts`** — `startRun(store, {url,auth}, deps)` creates a `running`
  record, kicks off the run, and flips it `done|failed` + indexes the bundle on exit; returns the record
  **synchronously** (poll-for-status surface). The shell-out is **injected** (`deps.run`) so it is
  headless-testable; `defaultRunner(fuiRoot)` spawns the FUI explorer via `npx vite-node` on
  `fui:tools/explorer/cli.ts` with the bundle dir as `--out` (the explorer attaches to the running dev
  server, never spins/kills one).
- **`plateau:vite.config.mts` → `explorerRuns()`** plugin (registered before `mockApi`): `POST` to the runs
  base (kick off → `202 {id,status}`), `GET` the runs base (index), `GET` a run by id (record), and `GET` a
  run's bundle file (served path-traversal-guarded, content-type by extension). The runs dir is git-ignored.

**Tests/verification:** `plateau:src/explorer-runs/explorer-runs.test.ts` — 10 headless tests (store CRUD +
persistence-across-instances, executor running→done/failed/threw lifecycle with an injected fake runner,
auth pass-through, bundle indexing). Full suite **273 pass** (+10). Live on the running :4000: `GET
/api/explorer/runs` → `[]`, unknown id → `404` JSON (config auto-reloaded). POST not exercised live (it
spawns the real explorer) — its path is covered by the unit test. The future executor-vs-store /slice and
the run-management UI ride on #1548.
