---
bornAs: xitk240
kind: story
size: 13
parent: "4097"
status: resolved
scope: ["we:scripts/conveyor/__tests__/sim/world.mjs", "we:scripts/conveyor/__tests__/sim/scenario.mjs", "we:scripts/conveyor/__tests__/sim/daemon-host.mjs", "we:scripts/conveyor/__tests__/helpers/fake-gh.mjs", "we:scripts/operations/__tests__/helpers/fake-claude.mjs", "we:vitest.integration.config.ts"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Sim step 1: stateful fake GitHub, fake sessions, fake clock, world + daemon hosts, 3 incident scenarios

Build the simulator harness and the first three incident scenarios (I-07 approved conflict grace, I-09 lane starvation, I-15/I-18 sibling self-sync + stale main mid-tick), each proven RED against its reverted fix and GREEN with it. See we:reports/2026-09-24-daemon-scenario-simulator.md.

## Done when

1. **Executable** — `npx vitest run --config=we:vitest.integration.config.ts we:scripts/conveyor/__tests__/sim-scenario-lane-starvation.test.mjs` (and the self-sync-sibling and approved-conflict-grace files) pass, and each fails when its fix is reverted in the working tree (`we:skills-src/conveyor/review-daemon.mjs` dispatch cap, `we:scripts/lib/daemon-self-sync.mjs` drift restart / stale re-sync, `we:scripts/conveyor/parked-pr-conflict-watch.mjs` queued-conflict target).
