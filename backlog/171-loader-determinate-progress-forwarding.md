---
type: idea
workItem: story
size: 3
parent: "135"
status: resolved
dateOpened: "2026-06-07"
blockedBy: ["152"]
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "blocks/resource-loader/ResourceLoader.ts (reportProgress + resource-progress event) + backgroundHandoff.ts (ResourceLoaderHandle forwards fraction onto LoaderSnapshot.progress); demo card in demos/loader-background-handoff-demo.ts (determinate-progress scenario)"
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

## Progress

- **Status:** resolved (2026-06-09) — determinate path wired end to end.
- **Done:**
  - `ResourceLoader.reportProgress(loaded, total?)` (`blocks/resource-loader/ResourceLoader.ts`) emits a
    bubbling `resource-progress` event with a clamped 0..1 `fraction` (two-arg normalizes `loaded/total`;
    single-arg reports the fraction directly). New `ResourceProgressDetail` in `types.ts`.
  - `ResourceLoaderHandle` (`backgroundHandoff.ts`) listens for `resource-progress` and overlays the
    fraction onto its snapshot without changing state (`{ ...snapshot, progress }`), so the surface's
    `#onSnapshot` advances the entry's native `<progress value>`. Listener registered in the constructor
    and released in `dispose()` (composes with #172).
  - Shared fixture scenario `determinate-progress` (`__fixtures__/handoff-scenarios.ts`) + a demo card in
    the handoff playground (`demos/loader-background-handoff-demo.ts`) — both consume the one fixture.
  - Unit regression test (snapshot + rendered bar + clamp); real-browser verify: playground shows **4/4**
    invariants, the determinate bar fills 25%→75%.
- **Verified:** resource-loader + background-task-surface suites green (89 tests); `check:standards` 0
  errors; `tsc` clean for touched files; playground 4/4 at `/demos/loader-background-handoff-demo.html`.
- **Notes:** scope was the *handoff* path (determinate value off-view). An in-place determinate trait
  (a `withDeterminate` consuming `resource-progress` for the non-backgrounded loader UI) is a separate
  concern this item didn't promise — not opened as a leftover.
