---
kind: task
parent: "2405"
status: resolved
dateOpened: "2026-07-10"
dateStarted: "2026-07-11"
dateResolved: "2026-07-11"
graduatedTo: "vitest.config.ts — poolMatchGlobs routes scripts/__tests__/gate-entrypoint-integration.test.mjs to its own singleFork forks-pool process, off the shared threads pool the rest of the suite runs on. Measured: solo time unchanged (~3.2s); under full-suite contention the file's own time dropped ~102s→~83s and total suite wall-clock ~112s→~95s (two full local `npm test -- run` runs, same machine, isolation change only)."
tags: []
---

# Speed up the gate-entrypoint integration test (subprocess contention)

The hermetic entrypoint integration test (we:scripts/__tests__/gate-entrypoint-integration.test.mjs) spawns real node subprocesses driving the we:scripts/merge-ai-prs.mjs CLI: ~3s alone but ~51s under full-suite CPU contention (measured against the concurrent lane-pool subprocess test). It passes, so this is a perf/CI-time follow-up, not a correctness bug. Options: run it in a serial/isolated vitest pool, trim to a single representative scenario, or mark it a slow-lane test. Do it only if the full suite wall-clock becomes a problem — otherwise leave as-is.
