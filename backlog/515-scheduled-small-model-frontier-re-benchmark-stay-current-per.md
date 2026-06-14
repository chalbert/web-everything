---
type: idea
workItem: task
parent: "490"
status: resolved
blockedBy: ["512"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: scripts/design-refs/frontier.mjs (+ design-refs/frontier-ledger.json, npm run design-refs:frontier) — beats-bundled detector + #192 freshness signal over the #512 benchmark
tags: []
---

# Scheduled small-model frontier re-benchmark (stay-current, per #488 F5)

A recurring re-benchmark of the small-model frontier (the #192 cadence) on slice B's (#512) benchmark harness, so a newly-released student/quantization that beats the bundled on-device default surfaces automatically rather than being missed. The body of #490 flagged this to spin out as its own recurring task once the benchmark suite exists. Sub-work under epic #490 (no standalone burndown value).

## Progress

Resolved 2026-06-14 (batch). Built the recurring layer over the #512 benchmark:
- `scripts/design-refs/frontier.mjs` — pure, fixture-tested decision functions: `summarizeResult` (benchmark result → metric tuple), `beatsBundled` (a candidate is promoted only if it GRADUATES and strictly improves verdict-agreement without regressing the asymmetric quarantine-recall floor; first graduating candidate wins against no champion), `isOverdue` (#192 cadence freshness), `foldRun` (history-preserving ledger append + champion promotion), `formatStatus`. Plus a CLI: no-args prints status + **exits 1 when overdue** (the scheduled-agent trigger), `--record <result.json>` folds a benchmark result in.
- `design-refs/frontier-ledger.json` — seeded ledger (30-day cadence, no champion yet — the API bridge #485 is today's default; corpus is all-ungated so no student has graduated).
- `npm run design-refs:frontier` alias; 8 unit tests.

It runs no model (the training is the separately-gated #513) — it's the cadence/freshness/delta-surfacing harness so a newly-released student that beats the bundled default surfaces automatically rather than being missed. No-leakage (#475): candidates are opaque ids. Per #488 F5, sub-work under epic #490. check:standards green.
