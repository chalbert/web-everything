---
type: issue
workItem: task
parent: "152"
status: open
dateOpened: "2026-06-07"
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
