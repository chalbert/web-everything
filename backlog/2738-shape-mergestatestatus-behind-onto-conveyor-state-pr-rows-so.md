---
bornAs: xhs7qbv
kind: task
status: resolved
blockedBy: ["2666"]
dateOpened: "2026-07-27"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
scope:
  - we:scripts/readiness/conveyor-state.mjs
  - we:scripts/readiness/__tests__/conveyor-state.test.mjs
---

# Shape mergeStateStatus (BEHIND) onto conveyor-state PR rows so the CI-heal loop's BEHIND branch goes live

we:scripts/conveyor/tick-core.mjs isCiHealTarget/isBehind (#2666) already reads a PR row's mergeStateStatus to heal a not-landable BEHIND+parked PR, but we:scripts/readiness/conveyor-state.mjs shapePrs does not populate it (its gh pr list --json fetches number,state,statusCheckRollup,labels,headRefName). Add mergeStateStatus to that field set and carry it onto each shaped PR row. Until then the BEHIND branch is dormant and only the red-CI trigger fires; pure-BEHIND-with-green-CI parked PRs stay unhealed until this lands.

## Progress

- Added `mergeStateStatus` to the `gh pr list --json` field set in `we:scripts/readiness/conveyor-state.mjs`.
- `shapePrs` now carries `mergeStateStatus` through raw (normalized to a string, `''` when absent) onto each shaped PR row, so `we:scripts/conveyor/tick-core.mjs` isBehind/isCiHealTarget's BEHIND branch reads a live value.
- Extended `we:scripts/readiness/__tests__/conveyor-state.test.mjs`: shapePrs maps/defaults the field, plus a #2738 case asserting BEHIND is carried and absent→`''`; updated the assembleConveyorState end-to-end `s.prs` assertion for the new key.
