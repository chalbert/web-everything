---
bornAs: xmje9g6
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["5000"]
scope: ["we:scripts/conveyor/main-red-recovery.mjs", "we:scripts/conveyor/main-red-culprit.mjs", "we:scripts/conveyor/__tests__/"]
dateOpened: "2026-10-03"
tags: []
---

# Culprit finding for a red main: bisect the range between the last green and first red completed main run

Revert-first is the standard answer to a red trunk (Chromium sheriffs; Google Build Cop; LUCI Bisection auto-reverts culprits; Google's flake-aware culprit finding found about 40% of 13,600 breakages were flakes with no culprit). On 2026-10-03 main was red for about six hours (completed main runs: green at 8ea816283, red from 915c69d3b onward). #3361 (deferred 2026-08-26 until it hurts) arms the drain's stop-the-line and revert-to-green, but when several PRs landed between the last green and the first red run it needs a culprit first. Build a pure planner plus a thin IO shell beside we:scripts/conveyor/main-red-recovery.mjs: from the last-green and first-red SHAs, list the PR merges in the range; rerun the failing job once on the first-red SHA to rule out a flake; then bisect by running only the failing job on midpoint SHAs (workflow_dispatch on a temporary ref, never a push to main); output culprit PR, confidence and a flake-suspected flag, journaled. It never reverts by itself: it hands the culprit to the drain-owned revert path of #3361, because the drain is the sole main writer (anchor event-driven-land-is-wake-only in we:docs/agent/platform-decisions.md). Depends on the main-CI-coverage card so the range stays small. Survey: we:reports/2026-10-03-delivery-strategy-survey-and-decider.md. Done when: a replay on the 2026-10-03 range 8ea816283..915c69d3b names a culprit or a flake with the dispatched runs as evidence; unit tests cover range listing, the flake rerun and the bisection steps.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
