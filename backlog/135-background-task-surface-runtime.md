---
type: idea
status: active
dateOpened: "2026-06-06"
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
