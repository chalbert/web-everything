---
type: issue
workItem: task
parent: "135"
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-07"
dateResolved: "2026-06-07"
tags: [block, background-task, docs, drift]
relatedProject: webintents
crossRef: { url: /blocks/background-task-surface/, label: Background Task Surface }
---

# Reconcile the Background Task Surface block page with the shipped baseline runtime

The [Background Task Surface](/blocks/background-task-surface/) block page (`src/_includes/block-descriptions/background-task-surface.njk`) was authored as the full spec (#128); the runtime (#135) ships the **route-only baseline**, so a few illustrative types/exports on the page no longer match what is exported.

Drift to reconcile (page → shipped):
- **Interface block** documents `BackgroundTaskSurfaceConfig` with `navigationGuard: 'none' | 'warn'` and a `durability` axis; the shipped `BackgroundTasksConfig` is the baseline — boolean `navigationGuard` / `completionToast` / `retry`, `aggregation`, `persistence`, and **no `durability`** (that is the #134 reload tier). Progress is documented as `value?: number // 0-100`; the shipped `LoaderSnapshot.progress` is `0..1` (fed to native `<progress max=1>`).
- **Exports table** lists `BackgroundTaskRegisterEvent` (Event Class) and `BackgroundTaskSurfaceConfig`; the runtime exports event **detail types** (`BackgroundTaskRegisterDetail`, `…StateChangeDetail`, `…RetryDetail`, `…DismissDetail`) and `BackgroundTasksConfig`. `withReloadDurability` is listed as an export but is intentionally **not implemented** (it is #134) — mark it as a documented future trait, not a shipped export.

Decide per item whether the **page** is the canonical spec (then the runtime grows to match in a later tier) or the **runtime** is canonical (then the page is corrected). Keep the spec-vs-baseline distinction explicit either way so the page does not read as "all shipped".

Spun off from #135 close-out.

## Resolution — runtime is canonical; page corrected to the shipped baseline

Resolved by making the **runtime canonical** (the route-only baseline #135 is the deliberate shipped
shape; #128 over-documented the full spec). The page now matches `blocks/background-task-surface/`
exactly, with the spec-vs-baseline distinction kept explicit. Edits to
`src/_includes/block-descriptions/background-task-surface.njk`:

- **Interface block** — replaced the speculative `BackgroundTaskSurfaceConfig` (with `navigationGuard:
  'none' | 'warn'` and a `durability` axis) with the shipped `BackgroundTasksConfig` (boolean
  `navigationGuard` / `completionToast` / `retry`, plus `aggregation` / `persistence`, no `durability`).
  Swapped the invented `BackgroundTask` shape for the real `LoaderSnapshot`, fixing progress from
  `value?: number // 0-100` to `progress?: number // 0..1`. Added a note that this is the route-only
  baseline and `durability` is the future #134 tier.
- **Dimensions table** — the `durability` row is now labelled "future #134, not in the shipped baseline"
  and its trait `withReloadDurability (future)`.
- **Exports table** — replaced the non-existent `BackgroundTaskRegisterEvent` (Event Class) and
  `BackgroundTaskSurfaceConfig` rows with the real exports: the four event **detail types**,
  `BackgroundTasksConfig` (+ `DEFAULT_CONFIG`), and `LoaderSnapshot` / `LoaderStateHandle`.
  `withReloadDurability` is marked **(future) — Not shipped**, landing with #134.

Verified against a clean 11ty build: the page renders `BackgroundTasksConfig`, the `0..1` progress,
and the `future #134` markers; no `BackgroundTaskSurfaceConfig` / `BackgroundTaskRegisterEvent` remain.
`check:standards` and build both green. No leftovers — the reload-durability tier is already tracked as
#134.
