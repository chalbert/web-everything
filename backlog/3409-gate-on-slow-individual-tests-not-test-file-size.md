---
bornAs: xazznqi
kind: task
status: open
dateOpened: "2026-08-30"
tags: []
---

# Gate on slow individual tests, not test-file size

Guard against a test file becoming a shard long-pole by test DURATION, not by line/test count -- a size threshold was considered and rejected: we:scripts/__tests__/stdout-flush.test.mjs proved the real signal is a couple of specific slow tests, not overall file size. Build on we:scripts/dev/report-slow-tests.mjs's existing JSON-reporter timing infra and turn it into an actual check with a configurable (not hardcoded) threshold.

Wire it into CI (likely the existing `test-selection-measure` job in we:.github/workflows/ci.yml, which already produces the JSON). Open design questions for whoever picks this up: warn vs error to start (follow the #2681/#2967 measure-then-gate precedent already in this repo), and where the threshold config lives (CLI flag, env var, or a check-standards-style config surface).

## Done when

1. **Executable** — `node we:scripts/dev/report-slow-tests.mjs <vitest-json> --fail-over-ms=<N>` (or equivalent) exits non-zero when any single test's `duration` exceeds a configurable threshold, and 0 when none do. Threshold configurable via CLI flag and/or env var, with a sane default -- not hardcoded inline. A fixture JSON with one deliberately-over-threshold test proves the fail path; the same fixture with that test's duration lowered proves the pass path.
2. Wired into CI (`we:.github/workflows/ci.yml`, likely the existing `test-selection-measure` job that already produces the JSON) as at least a warning; whether it starts as warn-only or blocking is this item's own call to make, following the #2681/#2967 measure-then-gate precedent already established in this repo.
