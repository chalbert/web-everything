---
type: issue
workItem: task
parent: "152"
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [block, background-task, loader, handoff, cleanup, listeners, leak]
relatedProject: webintents
crossRef: { url: /blocks/resource-loader/, label: Resource Loader }
---

# Dispose the handoff handle's loader listeners when its task is dismissed

`ResourceLoaderHandle` (`blocks/resource-loader/backgroundHandoff.ts`, wired in
[#152](/backlog/152-loader-background-task-handoff-wiring/)) attaches three listeners to the loader's
target (`resource-state-change` / `resource-load-end` / `resource-load-error`) and keeps them for the
loader's lifetime. It exposes `dispose()` but **nothing calls it** — there is no producer-side signal
when the surface drops the entry.

In practice the leak is bounded: the target is usually the consumer's element, so the listeners are
GC'd when that element is torn down with its view. But a **long-lived loader reused across many
`backgroundLoad()` calls** (without target teardown) accumulates handle listeners that never detach.

Close the loop: have `backgroundLoad` listen for the surface's bubbling `background-task-dismiss`
event (matching the registered `id`) and call `handle.dispose()` when its task is dismissed — keeping
listeners alive across `retry()` (re-run) but releasing them once the entry is truly gone. Add a
regression test (a dismissed task's handle has detached) alongside the existing handoff unit suite.

Spun off from #152 close-out (handle disposal was documented + exposed but left to the consumer).

## Progress

- **Status:** resolved (2026-06-09) — loop closed.
- **Done:** `backgroundLoad` now attaches a `background-task-dismiss` listener (on `source.getRootNode()`,
  the shared root the surface bubbles into, since dismiss bubbles *up* from the `<background-tasks>`
  ancestor and never reaches `loader.target`) at escalation time; on a matching `id` it calls
  `handle.dispose()`. Listeners survive `retry()` (no re-register) and a host-vetoed sticky dismiss
  (`defaultPrevented` is honored). Two regression tests added to the handoff suite (detach-on-dismiss;
  skip-on-cancel). All resource-loader + background-task-surface suites green (88 tests); `check:standards`
  0 errors; no new `tsc` errors in touched files.
- **Notes:** internal cleanup, not a new user-facing dimension — no new conformance demo case needed
  (the handoff playground already exercises dismiss visually; disposal is invisible).
