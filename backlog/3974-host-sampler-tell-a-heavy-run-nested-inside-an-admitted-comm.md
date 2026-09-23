---
bornAs: xri6kfa
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/operations/host-sampler-episodes.mjs", "we:scripts/operations/host-sampler-rollup.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Host sampler: tell a heavy run nested inside an admitted command from one that bypassed the admission pool

Audit 2026-09-23: about half of heavy.run.episode records have admitted false (143 of 307 on 2026-09-21, 180 of 354 on 2026-09-22, 136 of 267 on 2026-09-23), spread over vitest, check-standards, verify-lane and playwright. The data cannot say whether such a run is a child of an admitted command (for example vitest inside an admitted verify, which is fine) or a raw command that went around we:scripts/readiness/heavy-admission.mjs (a hand-typed npx vitest run, #3793, or the visual-capture pass, #3471). Until it can, the pool's cap of 2 does not describe the real heavy load, and the attribution gate the #3737 jury asked for (the share of over-core time owned by slot holders) cannot be computed. Fix: in we:scripts/operations/host-sampler-episodes.mjs findHeavyRuns, walk each run's ancestry and set admission as one of admitted, nested-in-admitted (with the parent episode id) or bypass, and add a rollup of CPU-seconds by that class per hour. Lives on the prototype branch (graduation #3899). Done when: a unit test covers all three classes, and the rollup on real data reports the bypass share of heavy CPU-seconds per day.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
