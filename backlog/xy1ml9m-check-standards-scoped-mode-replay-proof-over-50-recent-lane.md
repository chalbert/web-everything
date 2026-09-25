---
kind: story
size: 5
parent: "xq5ggfh"
status: open
scope: ["we:scripts/readiness/check-standards-scope-replay.mjs", "we:scripts/readiness/claimScope.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# check:standards scoped-mode replay proof over ~50 recent lane diffs

Build the evidence harness that gates epic xq5ggfh: take ~50 recent merged lane diffs, run check:standards in full mode and in the scoped --local --files mode on each, and compare the findings restricted to the lane's own changed files plus their linked files. Report per-diff wall time and any finding the scoped mode missed (a false-green). Mirrors the measure-before-default discipline #2681 applied to vitest selection (we:scripts/readiness/test-selection.mjs). Deliver as a runnable script plus a checked baseline report; every later slice of xq5ggfh must re-run it and show zero lane-own misses, with before/after timings, before landing. Live proof required, not just unit tests.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
