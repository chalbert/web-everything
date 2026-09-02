---
bornAs: xny5uon
kind: story
size: 3
parent: "3402"
status: open
blockedBy: ["3445"]
scope: ["we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/"]
dateOpened: "2026-09-01"
tags: []
---

# Extend the fixture harness through we:dispatch-lane.mjs's real argv-building and guard logic with withFakeClaude()

#3402 (Fork 2, ratified) extends the Fork-1 fixture harness one hop further: run the REAL we:scripts/conveyor/tick-core.mjs / we:scripts/readiness/dispatch-plan.mjs / we:scripts/operations/dispatch-lane.mjs argv-building and guard logic (assertNotALaneCheckout, backoff, lane acquisition) against the fixture state from the item above, with we:scripts/operations/__tests__/helpers/fake-claude.mjs's withFakeClaude() on PATH (not an injected spawnAgent override), and assert the produced argv/guard behaviour against the fixture. Spawns zero real agents; touches zero real backlog items or PRs. Per we:docs/agent/platform-decisions.md#skill-memory-replay-substrate.

## Done when

1. **Executable** — a new vitest extends the Fork-1 fixture harness one hop further: with `withFakeClaude()` on `PATH`, it drives the real `we:scripts/conveyor/tick-core.mjs` → `we:scripts/readiness/dispatch-plan.mjs` → `we:scripts/operations/dispatch-lane.mjs` pipeline against the fixture state, and asserts the produced argv (`fake.lastArgv()`) matches the fixture-derived expectation. The test fails on `main` today (the harness doesn't reach `we:dispatch-lane.mjs` yet) and passes once this item lands.
2. **Executable** — the same harness run asserts `we:scripts/operations/dispatch-lane.mjs`'s guard/backoff/`assertNotALaneCheckout` behaviour fires correctly against the fixture inputs, with zero real `claude` sessions spawned and zero real backlog items or PRs touched.
3. **Executable** — `npm run check:standards` stays green.
