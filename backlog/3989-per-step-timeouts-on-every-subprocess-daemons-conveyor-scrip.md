---
bornAs: x5n4zn3
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:scripts/lane-pool.mjs", "we:scripts/readiness/conveyor-state.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# per-step timeouts on every subprocess daemons/conveyor scripts spawn, so a hang fails fast

The 2026-09-23 incident (#3383) stalled the drain, review daemon, and every test for over an hour
because nothing spawned by `we:scripts/lane-pool.mjs`/`we:scripts/readiness/conveyor-state.mjs`/
`we:scripts/readiness/dispatch-plan.mjs` had a per-call timeout — a runaway `git cherry` loop just ran
until it finished. Existing evidence this class of hang recurs: the drain's own top-level 45-minute
PASS cap (a coarse backstop, not a per-step one) and observed `spawnSync claude ETIMEDOUT` failures
from delegated-model calls. A sibling item (#3991, already landed) built the mechanism —
`we:scripts/lib/bounded-child.mjs` (`runBounded` + `installChildReaper`: hard timeout, own process
group, dies with its parent) — and wired it into `we:scripts/readiness/dispatch-plan.mjs`'s own
collector calls only. This item is the ROLLOUT: wire the same `we:scripts/lib/bounded-child.mjs` into
every OTHER `execFileSync`/`spawnSync` call site the daemons and conveyor scripts still issue bare, so
an individual hung subprocess fails fast everywhere, not just in one caller.

## Done when

1. **Executable** — every `execFileSync`/`spawnSync` call site in `we:scripts/lane-pool.mjs`,
   `we:scripts/readiness/conveyor-state.mjs`, `we:scripts/readiness/scope-lease-collect.mjs`, and
   `we:scripts/conveyor/*.mjs` (excluding the ones `we:scripts/readiness/dispatch-plan.mjs` already
   covers) is switched to `we:scripts/lib/bounded-child.mjs#runBounded` with a sensible per-call
   default (e.g. 2 minutes for a listing/status call), proven by a test that a deliberately-hung fake
   subprocess is killed and reported instead of blocking the caller indefinitely.
