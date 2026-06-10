---
type: idea
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-06"
blockedBy: ["129"]
dateResolved: "2026-06-07"
graduatedTo: block:background-task-surface
tags: [block, background-task, custom-element, runtime, implementation]
relatedProject: webintents
crossRef: { url: /blocks/background-task-surface/, label: Background Task Surface }
---

# Background Task Surface — runtime implementation (draft → active)

The [Background Task Surface](/blocks/background-task-surface/) block (#128) is specified at `status: draft` — blocks.json entry, design decisions, dimensions, events, and interface — but has **no runtime** (`sourcePath`). This item builds the actual custom element so the block can graduate `draft → active`.

Scope:
- A `<background-tasks>` custom element (`BackgroundTasksElement`) placed once in the app shell as a Layout `rail`.
- The bubbling `background-task-register` listener (nearest-ancestor resolution) that adopts the carried Loader-state handle and renders one entry per task — subscribing to the live Loader state machine off-view, not reimplementing progress.
- The traits: `withBatchAggregation`, `withStickyEntries`, `withNavigationGuard`, `withCompletionToast`, `withPerTaskRetry` (reload-durability is its own item, #134).
- The `role="status"` live region for off-view completion/failure announcement.
- Emitting `background-task-state-change` / `-retry` / `-dismiss` per the block's event table; retry delegates to the Reliability Intent.
- A conformance-playground demo (per the demo-first convention) before any real block-page wiring.

Depends on the navigation-guard contract (#129) for the `withNavigationGuard` half; can ship route-only without #134.

Spun off from #128 (the standard is authored; this is the build).

## Progress

- **Status:** resolved → `block:background-task-surface` (graduated `draft → active`).
- **Branch:** docs/standard-authoring-workflow
- **Done:** Built `blocks/background-task-surface/` — `BackgroundTasksElement` (register handoff w/ nearest-ancestor `stopPropagation`, off-view Loader-handle subscription, state machine + `background-task-state-change`/`-retry`/`-dismiss`, polite `role="status"` region, transient auto-clear vs sticky/error persistence, single/batch aggregation, route-only nav guard) + 5 traits (`withBatchAggregation`, `withStickyEntries`, `withNavigationGuard`, `withCompletionToast`, `withPerTaskRetry`) + `registerBackgroundTasks` + `index`. Shared fixture (`MockLoaderHandle` + scenarios) drives both the conformance playground (`demos/background-task-surface-demo.*`, registered in demos.json) and 18 unit tests. Added `sourcePath` + `exports` and flipped the block to `active`; fixed the block page's runnable example (`guard="warn"` → `navigation-guard`). Regenerated AGENTS.md inventory.
- **Verified:** 1510 unit tests green (18 new); standalone strict typecheck clean; `check:standards` 0 errors; `build:check` clean; Playwright playground smoke green in a real browser on :3000.
- **Notes:** `withReloadDurability` deliberately OUT (it's #134). `withNavigationGuard` ships route-only (beforeunload + Navigation API inline) with a forward-ref to #129. Leftovers captured: **#152** (real ResourceLoader→`LoaderStateHandle` producer wiring at `escalation:async`), **#153** (reconcile the block page's Interface/Exports with the shipped baseline runtime).
