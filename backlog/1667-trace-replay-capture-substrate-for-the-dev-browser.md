---
kind: story
size: 8
parent: "142"
status: resolved
locus: plateau-app
relatedTo: ["1666", "1646", "1649"]
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "plateau:src/dev-browser/capture/"
tags: [dev-browser, capture, trace, replay, substrate]
---

# Trace/replay capture substrate for the dev browser

Build the shared trace/replay capture substrate the dev browser's full-context features ride: record the ordered semantic action trace (intents fired, state transitions) and snapshot the declared state of a running Web Everything app, reading the introspection the self-describing model already exposes — no app-specific instrumentation. This is the capture half that the repro-bundle export (#1666) serializes to a bundle, and the same mechanism the scenario/fixture library (#1646) and branch/run diff (#1649) consume; build it once here. Local-first and zero-server per the cost-flat rule. Foundational — the introspection it reads already exists, so it has no upstream blocker.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Built as a new dev-browser module `plateau:src/dev-browser/capture/` (types + capture + index + test):

- **`plateau:src/dev-browser/capture/types.ts`** — the capture model: `TraceEvent` (an `intent` or
  `transition` `RawTraceEvent` stamped with monotonic `seq` + `atMs`), `DeclaredStateSnapshot`, `CaptureTrace`
  (events + snapshots + `startedAtMs`), and the **single app seam** `IntrospectionSource`
  (`snapshotDeclaredState()` + `subscribe(listener)`) — the running app's *existing* self-describing surface
  adapted to capture, never new per-app code. Injectable `CaptureClock` for deterministic runs.
- **`plateau:src/dev-browser/capture/capture.ts`** — `CaptureSession`: `start`/`stop` (idempotent,
  subscribe/detach), `snapshot(label?)` on demand, and one **shared monotonic `seq`** across events *and*
  snapshots so their relative order is total. `trace()` returns a defensive copy (safe to serialize/diff
  after the session ends). Pure, in-memory, zero-server.
- **`plateau:src/dev-browser/capture/index.ts`** — public surface + `createCaptureSession(source, opts)`.
- **`plateau:src/dev-browser/capture/capture.test.ts`** — 5 tests, all green (ordering + initial snapshot,
  shared seq totality, stop-detaches, start/stop idempotency, defensive-copy isolation) over a stub source.

Layer note: this is the **capture** half only. The serialized **bundle wire shape** (declared-state +
trace + rules + ownership) is the separate WE-owned contract #1664; #1666 is the serializer that maps a
`CaptureTrace` onto it. #1646 (scenario lib) and #1649 (branch/run diff) consume `CaptureTrace` directly.
No app declares an `IntrospectionSource` yet — the substrate ships the generic seam; adapters land with
their consumers.
