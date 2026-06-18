---
type: idea
workItem: story
size: 3
parent: "135"
status: resolved
dateOpened: "2026-06-07"
blockedBy: ["135"]
dateStarted: "2026-06-07"
dateResolved: "2026-06-07"
graduatedTo: demo:loader-background-handoff-demo
tags: [block, background-task, loader, runtime, handoff, implementation]
relatedProject: webintents
crossRef: { url: /blocks/background-task-surface/, label: Background Task Surface }
---

# Loader → Background Task Surface handoff wiring (producer side)

The [Background Task Surface](/blocks/background-task-surface/) runtime (#135) is built and graduated: it adopts a carried `LoaderStateHandle` (`getSnapshot` / `subscribe` / `retry`) via a bubbling `background-task-register` event and hosts it off-view. But **nothing on the producer side emits that handle yet** — only the shared test/demo mock (`MockLoaderHandle`) constructs one. The real [Resource Loader](/blocks/resource-loader/) does not dispatch `background-task-register` when it crosses the `escalation:async` threshold.

This item wires the producer half so a real backgrounded Loader actually shows up in the surface.

Scope:
- A `LoaderStateHandle` adapter over `ResourceLoader` — translate its `resource-state-change` / `resource-load-end` / `resource-load-error` events (and its determinate/indeterminate progress) into the handle's `getSnapshot` + `subscribe(LoaderSnapshot)` contract; map `loading → active`, `success`/`empty → success`, `error → error`.
- Decide the `escalation:async` trigger: when/how a Loader decides work has gone async (a timing threshold? an explicit `escalate()` call?) and dispatches `background-task-register` with `{ id, label, progress, loaderState }`.
- Wire `handle.retry()` to a real re-`load()` so the surface's per-task retry (delegated via the Reliability Intent) actually recovers.
- A demo/showcase where a real Loader escalates into a live `<background-tasks>` rail (not the scripted mock).

Depends on the shipped surface runtime (#135). Pairs with the navigation-guard intent (#129) and the reload-durable tier (#134), but is independent of both.

Spun off from #135 close-out (the surface adopts a handle; this produces one).

## Progress
- **Status:** resolved — producer handoff wired, tested, demoed, verified in a real browser.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `we:blocks/resource-loader/backgroundHandoff.ts` — `ResourceLoaderHandle` (adapts the Loader's events into the surface's `LoaderStateHandle`) + `backgroundLoad(loader, fn, { id, label })` driver + `BACKGROUND_TASK_REGISTER_EVENT`; exported from `we:blocks/resource-loader/index.ts` and `fui:blocks.json`.
  - `retry()` re-runs the original `load(fn, traits)` on the same handle (surface's per-task retry delegates to it).
  - Shared fixture `we:blocks/resource-loader/__fixtures__/handoff-scenarios.ts` (deferred lever + scenarios) imported by both the test and the demo (anti-drift).
  - Unit test `we:blocks/__tests__/unit/resource-loader/backgroundHandoff.test.ts` drives a **real** Loader → **real** `<background-tasks>` (3 invariants).
  - Demo `demos/loader-background-handoff-demo.{html,ts,css}` registered in `we:demos.json`; producer note added to `we:resource-loader.njk`.
  - Gate: full vitest **1582 pass**, `check:standards` **0 errors**, 11ty build green, demo verified headless **3/3 invariants** (no console errors).
- **Decision — escalation:async trigger:** reuse the Loader's existing debounce — escalate (dispatch `background-task-register`) **once, when the loader crosses into `loading`**. Fast ops that resolve before the threshold never enter `loading`, so they never escalate. Backgrounding is opt-in via `backgroundLoad()`. No new threshold invented (native-first).
- **Notes:** Type-only import of the surface's contract types into resource-loader (no runtime coupling — handoff is a bubbling DOM `CustomEvent`). State map: `loading`→active (`resource-state-change`), `success`/`empty`→success (`resource-load-end`), `error`→error w/ Error (`resource-load-error`); `idle`/`pending`/`stale` ignored. Numeric progress stays undefined (Loader has no progress events) → follow-up [#171](/backlog/171-loader-determinate-progress-forwarding/). Handle keeps loader listeners for the loader's lifetime (`dispose()` exposed but uncalled) → follow-up [#172](/backlog/172-handoff-handle-dispose-on-dismiss/).
