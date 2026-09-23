---
kind: story
size: 3
parent: "xjtmptc"
status: resolved
blockedBy: ["xs0eutz"]
scope: ["we:scripts/lib/telemetry-machine.mjs", "we:scripts/__tests__/telemetry-machine.test.mjs", "we:scripts/operations/telemetry-summary.mjs", "we:scripts/operations/telemetry-summary-io.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/telemetry-summary.test.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs", "we:scripts/lib/telemetry-summary.mjs", "we:scripts/__tests__/telemetry-summary.test.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
graduatedTo: "we:scripts/operations/telemetry-summary.mjs"
tags: []
---

# telemetry-summary operation: machine load and source health, the io reader, and the declared read-only operation

Adds the machine and sources halves of the TelemetrySnapshot v1 (plateau:docs/telemetry-page.md) and ships the declared operation telemetry-summary (run with --json through we:scripts/operations/run.mjs) as a compute-only read, in the gate-health shape: pure lib, io module, declaration. Reads the collector root (OPERATION_CLAUDE_OTEL_DIR, else the shared workspace root, else the primary checkout) and the host-sampler store and rollups; reports which roots it read; names a source that failed in degraded; flags the collector hazard while its launchd script path is missing (#3739).

## Done when

1. **Executable** — `node we:scripts/operations/run.mjs telemetry-summary --json > the output file` exits 0 and `the output file` has
   `v: 1`, `week`, `today`, `last10`, `machine`, `sources`, `hazards`, `degraded` (unknown operation before this item).
2. `npx vitest run we:scripts/__tests__/telemetry-machine.test.mjs we:scripts/operations/__tests__/telemetry-summary.test.mjs`
   passes: hourly busy % per ET hour from host metrics, load by day from rollups, the degraded rule (collector silent
   more than 15 min while `host.sessions.live` > 0 → `claude-usage` stale; silent with 0 sessions → ok), a missing
   directory → that source `missing` and named in `degraded` while the rest still render, the hazard present only when
   the collector plist's script path does not exist.
3. Today's raw host file is read with bounded MEMORY, never loaded whole. `machine.now` (busy/sessions/
   pressure/cores) reads a bounded tail (a few MB) — a test feeds a large fixture and asserts only the tail is
   read. `machine.todayHourlyBusyPct` needs the whole day's history, which a tail cannot supply past the first
   elapsed hour or so of a multi-tens-of-MB file — real-data check found only 1 of 8 elapsed ET hours filled —
   so it is built from a fixed-size-chunk, synchronous, start-to-end scan (never an async stream: the
   declaration's `compute` step calls its reader with no `await`) that holds one chunk buffer, one
   carried-over partial line and the small filtered sample array at a time, never the file's full content.
4. The snapshot names each root it read (`sources[].root`) and stays under 64 KB on the real laptop data.
