---
kind: task
status: open
blockedBy: ["2666"]
dateOpened: "2026-07-27"
tags: []
---

# Shape mergeStateStatus (BEHIND) onto conveyor-state PR rows so the CI-heal loop's BEHIND branch goes live

we:scripts/conveyor/tick-core.mjs isCiHealTarget/isBehind (#2666) already reads a PR row's mergeStateStatus to heal a not-landable BEHIND+parked PR, but we:scripts/readiness/conveyor-state.mjs shapePrs does not populate it (its gh pr list --json fetches number,state,statusCheckRollup,labels,headRefName). Add mergeStateStatus to that field set and carry it onto each shaped PR row. Until then the BEHIND branch is dormant and only the red-CI trigger fires; pure-BEHIND-with-green-CI parked PRs stay unhealed until this lands.
