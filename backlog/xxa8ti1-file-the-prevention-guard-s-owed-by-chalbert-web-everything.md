---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2981's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:624` — Export a testable `buildDryRunReport(effects)` seam, or add an integration test asserting `dryRun`'s `ifFreed` wip-cap count equals `tick.plan.openItems` on a worker-PR fixture.
2. `we:skills-src/conveyor/build-dispatch-daemon.mjs:146` — Have the readers return a sentinel or error flag instead of a bare []. Then have `planBuildDispatch` fall back to the unfiltered union (dispatchedByBuilder = null) when a read fails. Add a tick-level test that forces a reader error and asserts the cap still counts every open PR. Filing this as a backlog card is a reasonable alternative to a lint rule, since a lint cannot decide fail direction.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:258` — Add a deterministic daemon test with builder-owned open PRs already at capacity and a failed attribution read, asserting no further dispatch; preserve read-error status and fall back to the unfiltered PR union. This follow-up is already recorded in the changed backlog card.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2981@bef8e3972fcde5e026e7ca0c8e8aecc08074f6df

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
