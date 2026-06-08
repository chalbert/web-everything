---
type: idea
workItem: story
size: 3
parent: "135"
status: open
dateOpened: "2026-06-07"
tags: [block, background-task, loader, progress, determinate, handoff]
relatedProject: webintents
crossRef: { url: /blocks/resource-loader/, label: Resource Loader }
---

# Forward determinate numeric progress through the Loader → Background Task handoff

The producer handoff wired in [#152](/backlog/152-loader-background-task-handoff-wiring/) carries the
Loader's progress **mode** (`determinate`/`indeterminate`) on `background-task-register`, but the
surface's per-task `LoaderSnapshot.progress` (a `0..1` fraction) is **always undefined** — because
`ResourceLoader` has no numeric-progress event to forward. So a `determinate` background task renders
as an indeterminate spinner, never a real progress bar.

Wire the determinate path end to end:

- Add a progress signal to `ResourceLoader` — e.g. a `reportProgress(fraction)` method or a
  `resource-progress` event (`{ loaded, total }` / `0..1`), driven by the consumer's `fn` (a fetch
  with `ReadableStream` byte counts, an upload's `XMLHttpRequest.upload.onprogress`, or an explicit
  call).
- Have `ResourceLoaderHandle` (`blocks/resource-loader/backgroundHandoff.ts`) translate that into
  `LoaderSnapshot.progress` and emit a snapshot so the surface's progress bar advances.
- A demo card in the [handoff playground](/demos/loader-background-handoff-demo/) showing a
  determinate task filling its bar (extend `handoff-scenarios.ts`, keep the shared-fixture split).

Depends on the shipped producer wiring (#152). Independent of the reload-durable tier (#134), though
both touch progress reporting.

Spun off from #152 close-out (the handoff carries the progress *mode* but no numeric value yet).
