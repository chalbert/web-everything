---
bornAs: x4cteem
kind: task
parent: "4075"
status: resolved
scope: ["we:.gitignore"]
dateOpened: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# gitignore we:.conveyor/unsupported-repo.json — untracked per-tick sidecar poisons daemon self-sync dirty-check, reds out main

origin/main's CI test job is red: both scenarios in we:scripts/conveyor/__tests__/sim-scenario-self-sync-sibling.test.mjs fail (expected undefined to be true on .restart). Cause: we:scripts/conveyor/unsupported-repo.mjs writes we:.conveyor/unsupported-repo.json on EVERY tick (even to record nothing-outstanding) via we:scripts/conveyor/reconcile-fix-dispatch.mjs and we:skills-src/conveyor/runner.mjs, and that path was never added to we:.gitignore, unlike every sibling we:.conveyor/*.json sidecar. An ungitignored per-tick sidecar reads as a permanently dirty tree, so we:scripts/lib/daemon-self-sync.mjs's decideSelfSync fails closed on dirty forever — self-sync never merges origin/main or restarts the daemon onto new code. Same failure class #3885 fixed for we:.conveyor/*.log on 2026-09-22, recurring for a different sidecar; affects live daemon clones, not just the simulator. Fix: add we:.conveyor/unsupported-repo.json to we:.gitignore (one line, matching the existing per-file convention). Verified green: sim-scenario-self-sync-sibling (both scenarios), sim-scenario-approved-conflict-grace, sim-scenario-lane-starvation, sim-clock, sim-scenarios-smoke.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
