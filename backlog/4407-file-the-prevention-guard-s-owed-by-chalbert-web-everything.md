---
bornAs: x0kopyt
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/lane-whois-core.mjs", "we:scripts/lib/__tests__/lane-whois-core.test.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "c3129f76022d7e2e039ab1d2106685c7c5841862"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2852's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/lane-whois-core.mjs` — Add parameterized regression tests rejecting negative counts, including cancellation between trackedModified and untracked, and require exactly zero counts before skipping reclaim.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2852@d4693d4a8e0c274cf4e5e4f50de4fcd63f9879d3

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/lane-whois-core.test.mjs we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs` (run from the repo root, without the `we:` prefixes) fails before this item lands (negative and cancelling counts are treated as clean) and passes after.

## Premise check

Still open on `main` (c3129f76). `isLaneAlreadyClean` (`we:scripts/lib/lane-whois-core.mjs:209-217`) only rejects `uncommittedCount > 0` / `aheadCount > 0`, so `-1` passes as "clean". `git log` shows no commit that adds a negative-count guard (#4344 added the function; #4370 did not touch this). The cancellation case is real too: `reclaimFinishedLanes` (`we:scripts/conveyor/lane-pool-health-watch.mjs:510-521`) sums `trackedModified + untracked`, so `-2 + 2` reaches the core as `0`.

## Scope note

Frontmatter `scope:` widened from the two core files to also cover the one call site and its test, because the cancellation case is only visible where the two components are still separate.

## Design

`isLaneAlreadyClean` must treat a count as clean only when it is exactly `0` (`Number.isInteger(n) && n === 0` semantics), not "not greater than 0". Replace the `Number.isFinite` + `> 0` pair at `we:scripts/lib/lane-whois-core.mjs:212-213` with a strict `=== 0` test on `uncommittedCount` and `aheadCount`; any other value (negative, fractional, `Infinity`, string) returns `false` and falls through to a real reclaim. For cancellation, add two optional params `trackedModified` and `untracked`: when either is supplied, BOTH must be exactly `0` (checked individually, before the summed count is trusted). `reclaimFinishedLanes` (`we:scripts/conveyor/lane-pool-health-watch.mjs:507-516`) passes `row.uncommitted?.trackedModified` / `.untracked` through alongside the sum. Update the `isLaneAlreadyClean` docblock's fail-closed paragraph to say "exactly zero".

## MVP

Musts:
- Exactly-zero check for `uncommittedCount` and `aheadCount` in `isLaneAlreadyClean`.
- Optional per-component `trackedModified` / `untracked` params, each required exactly `0` when supplied.
- Call site passes the components.
- Update the `isLaneAlreadyClean` docblock's fail-closed paragraph to say "exactly zero".
- Parameterized regression tests (below).

Out of scope: see Follow-ups.

## Test plan

In `we:scripts/lib/__tests__/lane-whois-core.test.mjs` (`describe('isLaneAlreadyClean')`), using `it.each`:
- `uncommittedCount` in `[-1, -5, -0.5]` with matching shas → `false`. RED today (all pass `> 0`). `[0.5, Infinity, '0']` are green guard cases (already rejected today) kept to prevent regression.
- `aheadCount` in the same sets → `false`, same RED/green split.
- One component supplied, one omitted (`{ uncommittedCount: 0, trackedModified: 0 }`) → `false` (both must be supplied). RED today (params ignored).
- Cancellation: `{ uncommittedCount: 0, trackedModified: -2, untracked: 2 }` → `false`, and `{ trackedModified: 2, untracked: -2 }` → `false`. RED today (params ignored, sum is `0`).
- `{ uncommittedCount: 0, trackedModified: 0, untracked: 0 }` at tip → `true` (guard against over-tightening).
- Components omitted entirely, `uncommittedCount: 0` → still `true` (back-compat for existing callers).

In `we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs`: a `finished-reclaimable` row with `uncommitted: { trackedModified: -2, untracked: 2 }` at tip must call `reclaimLane` (not `alreadyClean`). RED today: summed to `0`, skipped.

## Proof plan

Live before/after via a CLI probe on the real module: `node -e "import('we:./scripts/lib/lane-whois-core.mjs').then(m=>console.log(m.isLaneAlreadyClean({uncommittedCount:-1,aheadCount:0,headSha:'a',branchTipSha:'a',branch:'main',expectedBranch:'main'})))"` (without the `we:` prefix) prints `true` on `origin/main` and `false` after. Then `we:scripts/conveyor/lane-pool-health-watch.mjs --dry-run` (existing flag; it still publishes the free-lane sidecar, harmless) against the real pool: the `NOT reclaimed — already clean at the pool branch tip` lines for genuinely clean lanes are the same before and after (no over-tightening). The summary's "refused" count includes those lines, so compare the lines, not the count. Run the "before" from a checkout at `origin/main`.

## Follow-ups

- Validate the same non-negative-integer invariant at the source, in `we:scripts/lane-whois.mjs` where `trackedModified` / `untracked` are computed from path arrays (near line 498 there), if a negative could ever originate there (it cannot today: they are `.length` values).
