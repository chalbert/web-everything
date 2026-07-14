---
bornAs: xc0x4ec
kind: story
size: 3
parent: "2489"
status: resolved
dateOpened: "2026-07-14"
dateStarted: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, console, observability]
---

# Loop console — detectAnomalies core: stall & zero-merge-with-ready signals + health verdict

The keystone slice of the health & anomaly-detection epic (parent). Add a PURE
`detectAnomalies({ history, state, queue, events, nowMs })` to
`plateau:tools/drain-daemon/lib.mjs` — beside `deriveIncidents` / `summarizeQueue`, same
defensive, dependency-free, never-throws contract — with the two headline signals that catch a
"healthy-looking but not progressing" daemon, and roll a single health verdict into
`buildStatusReport` so the CLI and console read one authoritative answer. lib-only + unit tests;
no `plateau:tools/drain-daemon/daemon.mjs` edit, no restart.

## Signals

- **STALL** — `considered > 0 && merged === 0` across ≥N consecutive most-recent passes (skip
  `noop` lease-contention passes; they are not the daemon's fault). This is the exact we #477
  70-min-deadlock signature: every pass green, work considered, nothing landing. Severity escalates
  with run length (e.g. `warn` at N, `critical` past 2N). `since` = the `at` of the first pass in
  the run.
- **ZERO-MERGE-WITH-READY** — merge rate 0 across the recent window while the queue board
  (`summarizeQueue`'s `toMerge` / a ready count) is non-empty. Distinguishes "nothing to do"
  (healthy idle — considered 0, queue empty) from "work is ready but not landing" (stuck). When the
  live queue plan is absent (`queue` not passed / `valid:false`), degrade to the STALL signal alone
  — never throw, never false-alarm on missing data.

## Shape

`detectAnomalies` returns an ORDERED (most-severe first) array of
`{ type, severity, since, detail, evidence }`, mirroring `deriveIncidents`' row contract so the
console can render both through the same path. `buildStatusReport` gains a rolled-up
`health: 'healthy' | 'degraded' | 'stuck'` (worst active severity → verdict) plus the raw
`anomalies` array, so `status --json` and the browser both read one authoritative verdict without
re-deriving it.

## Definition of Done

- `detectAnomalies` unit-tested (`plateau:tools/drain-daemon/lib.test.mjs`): a synthetic run of
  `considered>0, merged 0, exit 0` passes → a STALL anomaly with correct `since`; a healthy idle run
  (considered 0, empty queue) → no anomaly; a ready-but-not-landing run → ZERO-MERGE-WITH-READY;
  garbage / empty / missing-queue inputs → `[]`, never a throw.
- `buildStatusReport` exposes `health` + `anomalies`; existing lib tests still green.
- No behavior change to the daemon loop or the lander — pure read-side derivation only.

## Notes

Thresholds (N consecutive passes, window size) are constants co-located with the detector, chosen
against the real 60s cadence (a stall is meaningful at a handful of passes ≈ a few minutes, not one
pass). Head-churn (needs per-pass considered-PR ids), degradation signals, the console badge, and
out-of-console alerting are sibling slices B–E under the parent epic — deliberately out of scope
here to keep this the smallest shippable keystone.
