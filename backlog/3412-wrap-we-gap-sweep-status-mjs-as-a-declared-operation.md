---
bornAs: xkp1mv8
kind: task
parent: "3273"
status: resolved
dateOpened: "2026-08-30"
dateStarted: "2026-09-01"
dateResolved: "2026-09-01"
graduatedTo: "we:scripts/operations/gap-sweep-status.mjs"
tags: []
scope:
  - we:scripts/operations/
---

# Wrap we:gap-sweep-status.mjs as a declared operation

Small, additive slice of #3273's census: we:scripts/gap-sweep-status.mjs (159 lines, 5 raw call sites, no operation) is self-contained over three JSON files under src/_data/, touches no hot/contended file besides the two registry lines #3273 says are fine for one slice. Picked as the mechanical-dispatcher (#3383) live-fire exercise target: small enough to prove the pipeline without real delivery stakes.

## Done when

1. **Executable** — a new `we:scripts/operations/gap-sweep-status.mjs` (declaration) +
   `we:scripts/operations/gap-sweep-status-io.mjs` (the one shell of the existing CLI) exist, following
   `we:scripts/operations/route-pr-outcome.mjs`'s shape as the closest precedent (a thin operation over an
   existing, already-tested CLI, no new logic). Covers the CLI's three modes — read (no args), `--snapshot`,
   `--baseline=PATH` — as declared inputs/effects, not raw argv passthrough.
2. Registered in `we:scripts/operations/run.mjs` and `we:scripts/operations/declared-homes.mjs` (the
   `#3224` scan's map), per #3273's own "HOW to slice it" section — these two lines are the only shared-file
   touch this slice needs.
3. Tests mirror `we:scripts/operations/__tests__/route-pr-outcome.test.mjs`'s structure: the declaration
   pure, the io shell's one shelled command asserted, a real-CLI-backed test proving the wrap doesn't drift
   from `we:scripts/gap-sweep-status.mjs`'s actual behavior (mirrors `we:route-pr-outcome-io-live.test.mjs`).
4. `npm run check:standards` clean — the new operation resolves the raw call sites this card exists to
   retire (#3273's own census table row for this script goes to "operation exists").

## Progress

- `we:scripts/operations/gap-sweep-status.mjs` (declaration) + `we:scripts/operations/gap-sweep-status-io.mjs`
  (the one shell of the existing CLI) added, following `we:scripts/operations/verify.mjs` /
  `we:scripts/operations/verify-io.mjs`'s shape as the closest precedent actually on `main` (the item's named
  precedent, `we:scripts/operations/route-pr-outcome.mjs`, exists only on the unmerged `lane/mechanical-dispatcher` branch, not on
  the `main` this lane built against).
- Registered in `we:scripts/operations/run.mjs` (`OPERATIONS[gap-sweep-status]`) and
  `we:scripts/operations/declared-homes.mjs`.
- Covers all three CLI modes (`status`/`snapshot`/`diff`) as declared inputs, with a three-valued
  `ok`/`violations`/`unrun` outcome mirroring `verify`'s `pass`/`fail`/`unrun`.
- Tests: `we:scripts/operations/__tests__/gap-sweep-status.test.mjs` (pure, fixture-driven) +
  `we:scripts/operations/__tests__/gap-sweep-status-integration.test.mjs` (drives the REAL CLI against a
  throwaway copy of the real data, proving the wrap doesn't drift — mirrors
  `we:scripts/operations/__tests__/verify-integration.test.mjs`, since no `we:*-io-live.test.mjs` precedent
  exists on `main` either).
- Did NOT rewire the raw-CLI mentions in `we:skills-src/gap-sweep-rerun/SKILL.md` /
  `we:skills-src/review-program/SKILL.md` to the new operation — out of scope per this card's own scope note
  ("touches no hot/contended file besides the two registry lines"). `check:standards`' #3224 scan will WARN
  (never error) on those raw mentions now that a `declared-homes` entry exists; rewiring them is follow-up.
