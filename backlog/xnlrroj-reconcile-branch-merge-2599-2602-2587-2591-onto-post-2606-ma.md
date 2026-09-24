---
kind: task
status: resolved
scope: ["we:scripts/lane-pool.mjs", "we:skills-src/conveyor/review-daemon.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# reconcile branch: merge #2599/#2602/#2587/#2591 onto post-#2606 main, plus the acquire wait-vs-scan fix

the wev-review-daemon clone (main + hand-loaded #2587/#2591/#2599/#2600/#2601/#2602) can't self-sync against main now that #2606 merged: real conflicts in we:scripts/lane-pool.mjs (#2599 vs #2602) and we:skills-src/conveyor/review-daemon.mjs (#2587/#2591 dispatch-cap fields). This branch reconciles all four PRs onto current main and adds the coordinator-reported scan/wait-ms decoupling fix on top of #2602's own scan-sharing fix.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
