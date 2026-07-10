---
kind: task
parent: "2405"
status: open
dateOpened: "2026-07-10"
tags: []
---

# Speed up the gate-entrypoint integration test (subprocess contention)

The hermetic entrypoint integration test (we:scripts/__tests__/gate-entrypoint-integration.test.mjs) spawns real node subprocesses driving the we:scripts/merge-ai-prs.mjs CLI: ~3s alone but ~51s under full-suite CPU contention (measured against the concurrent lane-pool subprocess test). It passes, so this is a perf/CI-time follow-up, not a correctness bug. Options: run it in a serial/isolated vitest pool, trim to a single representative scenario, or mark it a slow-lane test. Do it only if the full suite wall-clock becomes a problem — otherwise leave as-is.
