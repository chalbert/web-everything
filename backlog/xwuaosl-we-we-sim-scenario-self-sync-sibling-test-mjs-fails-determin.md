---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/conveyor/__tests__/sim-scenario-self-sync-sibling.test.mjs", "we:scripts/lib/daemon-self-sync.mjs", "we:scripts/conveyor/__tests__/sim/scenario.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# we: the self-sync-sibling daemon scenario simulator fails deterministically in CI on main (I-15/I-18)

we:scripts/conveyor/__tests__/sim-scenario-self-sync-sibling.test.mjs — both A1 (I-15 boot-HEAD-drift restart) and A2 (I-18 mid-tick stale-main restart) assertions fail with 'expected undefined to be true' on the required 'test' CI job, reproduced 3/3 times on PR #2637 (unrelated diff) and confirmed on a direct push CI run against main's own tip 869303b13 — this is a pre-existing red on main, not something the PR that surfaced it caused; the fix likely lives in we:scripts/lib/daemon-self-sync.mjs or the scenario harness (we:scripts/conveyor/__tests__/sim/scenario.mjs) since fixTicks[1].restart/ticks[1].restart read undefined instead of true

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/conveyor/__tests__/sim-scenario-self-sync-sibling.test.mjs` currently fails (`A1`/`A2` both read `undefined` where `true` is expected) and must pass, reproducibly, both standalone and inside the full `test` CI job.
