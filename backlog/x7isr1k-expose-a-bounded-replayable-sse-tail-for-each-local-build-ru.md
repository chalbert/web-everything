---
kind: story
size: 5
parent: "2778"
status: open
blockedBy: ["xjlx8w2"]
scope: ["plateau-app:src/build-runner/build-action.ts", "plateau-app:src/build-runner/build-action.test.ts", "plateau-app:src/build-runner/build-stream.ts", "plateau-app:src/build-runner/build-stream.test.ts", "plateau-app:vite.config.mts"]
dateOpened: "2026-10-02"
tags: []
---

# Expose a bounded replayable SSE tail for each local build run

Retain projected runner output and plan state per build and expose a read-only SSE tail with replay, bounded retention and final lifecycle. HTTP clients can follow a build independently of the board while existing polling, stop and WIP controls retain their behavior.

## Design and source seam

Second slice of #2778, blocked by #xjlx8w2; carries parent Design steps 2–4 and transport/lifecycle tests. Read we:backlog/2778-live-output-tail-for-a-running-build.md for the full prepared plan. Scope is exactly 5 paths / 2 areas: build runner plus root Vite configuration. The two stream helper files are proposed additions.

At inspected plateau-app revision `f1b2d3fe48632b13eb03e44fb59ccfe50b12fbb9`, the real seams are we:../plateau-app/src/build-runner/build-action.ts:67 (store), :115 (DTO), :273 (single observer), :333 (event callback), :341 (opening/terminal sequence); we:../plateau-app/vite.config.mts:753, :760 (existing GET routes). Existing preservation tests are at we:../plateau-app/src/build-runner/build-action.test.ts:88, :124, :211. Late observers have no history (read-only we:../plateau-app/src/build-runner/runner.ts:185).

1. Fan out from the existing callback into per-run retention; never attach a second observer to the shared runner. Keep run identity, increasing IDs, latest valid plan and lifecycle. Defaults from the prepared plan: at most 1 MiB and 1,000 retained events per run, ten terminal runs, never evict the active run. Bound oversized individual output too and mark truncation explicitly.
2. Keep buffers/listeners out of polling DTOs: the current DTO function spreads the run record, so use explicit projection or separate private storage. Cover lifecycle changes through the store update seam, including stopping. Preserve queue polling, stop behavior and WIP=1.
3. Add proposed we:../plateau-app/src/build-runner/build-stream.ts with the read-only HTTP/SSE adapter and matching we:../plateau-app/src/build-runner/build-stream.test.ts. Register `/api/backlog/build/:runId/events` before generic run GET in we:../plateau-app/vite.config.mts. Unknown/expired runs return 404 before headers. Opening a stream never spawns, steers or stops work.
4. Atomically register snapshot/replay and subscription; use JSON SSE payloads, IDs and heartbeats. Resume using Last-Event-ID without duplicate retained events; an out-of-retention cursor receives explicit reset/truncation. Disconnect or shed slow clients without blocking the worker, clear listeners/timers, and avoid permissive cross-origin exposure.
5. Runner exit precedes build completion: keep streaming through opening until opened/failed/stopped, publish terminal state, then close. The terminal snapshot instructs clients to close EventSource. Preserve latest valid plan across malformed updates and report absent plan explicitly. Lost/restarted runs are unavailable, never success; identity must prevent a prior run/cursor from attaching to a replacement after restart, including reused numeric sequence values.

## Test plan and done when

- Extend we:../plateau-app/src/build-runner/build-action.test.ts with capability assertions for correct run retention and exit → opening → terminal order; DTOs exclude all internals. Exercise stop/failure races and terminal eviction without evicting active work. Existing parser-independent WIP/stop/dry-run assertions stay green.
- Add real HTTP tests in we:../plateau-app/src/build-runner/build-stream.test.ts using the same handler registered by Vite with an injected delayed producer. Cover incremental delivery before completion, route matching, two clients, late attachment, cursor replay/reset, count/byte bounds, oversized output, 404, disconnect cleanup, backpressure, terminal replay/closure and cross-run isolation. No independently reimplemented mock server counts as proof.
- Run the targeted Vitest suites for both scoped test files from plateau-app. New capability assertions are expected RED on the base; preservation assertions GREEN. Mutations that serialize internal state, drop retained output, close at exit or permit a second active build must fail corresponding assertions.
- Probe the actual Vite endpoint with a controlled runner fixture through the real parser/build callback and an HTTP streaming client. Record receipt before producer exit, plan changes, validation text, replay and final lifecycle; exercise overflow, stop/failure and listener cleanup. No paid autonomous build, push or PR is required. This independently useful HTTP observation is the slice acceptance, not a promise deferred to the UI.

## Follow-ups

Keep evidence and testing lessons here. A helper test alone does not prove Vite registration or callback wiring; the real endpoint probe is required. Browser integration and simultaneous browser/HTTP proof are owned by #xkj71ne. Revalidate the event shapes against landed #xjlx8w2 before coding; expand no shared WE contract silently.
