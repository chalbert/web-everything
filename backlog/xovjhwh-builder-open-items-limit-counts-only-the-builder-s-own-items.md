---
kind: story
size: 3
tier: pinned
status: open
scope: ["we:scripts/conveyor/build-dispatch-policy.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Builder open-items limit counts only the builder's own items

Operator decision 2026-09-29 ~1:40 PM ET: the builder's open-items cap (wip-cap, #4353, maxOpenItems=7) must count only the builder's own items, not items built by hand-dispatched workers. Live 2026-09-29T17:26:28Z, we:scripts/conveyor/build-dispatch-policy.mjs's planBuildDispatch (~lines 241-283) built the WIP set as {inFlight} union {delivered-by-open-PR}, where the PR side is every open PR whose branch names a card (prDeliveredNum); openItems read 7/7 filled by 4293, 4304, 4312, 4314, 4318, 4321, x4mfp16 -- six worker PRs -- so wip-cap held 4382, 4131, 4319 and the builder built nothing. Same shape as the #4464 cap fix (PR #2924), which made maxConcurrentBuilds count only the builder's own builds.

## Design

Attribute an open PR to the builder through its own durable run records under
`~/workspace/.operations/coordination/build-dispatch-runs/` — the item nums the builder itself
dispatched a build for — rather than the current branch-name heuristic (`prDeliveredNum`, any open
PR whose branch names a card). Concretely, `planBuildDispatch` in
`we:scripts/conveyor/build-dispatch-policy.mjs` (~lines 241-283) builds its WIP set today as
`{inFlight} ∪ {delivered-by-open-PR}` where the PR side counts every open PR whose branch names a
card. The fix narrows the PR side to `{delivered-by-open-PR} ∩ {items the builder's own run
records show it dispatched}` — a worker-authored PR (fix worker, hand-dispatched worker, stranded
claim) for an item the builder never dispatched drops out of `maxOpenItems` entirely.

Those same worker PRs still count toward `maxOpenPrs` (unchanged — a separate cap, machine-wide PR
volume, not builder attribution) and still participate in scope-overlap holds (`hot-file`,
unchanged — a worker's in-flight scope must still block a conflicting builder dispatch). Only the
`wip-cap` (`maxOpenItems`) arithmetic changes. This mirrors the shape of the `maxConcurrentBuilds`
fix (x3vs6tu/#4464, PR #2924): that fix made the *build-slot* cap count only the builder's own
in-flight builds instead of every machine-wide "building" signal; this fix makes the *open-items*
cap count only the builder's own open-PR deliveries instead of every open PR that merely names a
card.

## MVP

- `planBuildDispatch` (or a small pure helper it calls) reads the builder's own dispatched-item
  set from `~/workspace/.operations/coordination/build-dispatch-runs/` (injected, not a direct
  `fs` read inside the pure policy module — same io-injection shape the module already uses for
  its other inputs) and intersects it against the open-PR-delivered set before folding that count
  into `maxOpenItems`.
- `maxOpenPrs` and the `hot-file` scope-overlap hold both keep reading the full open-PR set,
  unfiltered — no change to either.
- Kept out of scope: any change to how PRs are opened, labelled, or delivered; any change to the
  worker/fix-dispatch paths themselves.

## Test plan (each fails before the fix)

1. Pure planner test: a worker-dispatched item with an open PR (not in the builder's own run
   records) is NOT counted toward `maxOpenItems`, at any occupancy.
2. Pure planner test: a builder-dispatched item with an open PR (present in the builder's own run
   records) IS counted toward `maxOpenItems`, unchanged from today.
3. Pure planner test: dedupe against `inFlight` — an item that is both currently building
   (`inFlight`) and has an open PR from a prior build is counted once, not twice.
4. Pure planner test: `maxOpenPrs` and the `hot-file` scope-overlap hold are unaffected by any of
   the above — a worker PR still counts toward `maxOpenPrs` and still blocks a scope-overlapping
   builder dispatch.

## Proof plan (live, before/after)

- **Before (soak break):** revert the attribution change (fold worker-delivered PRs back into
  `maxOpenItems`) and re-run `node we:skills-src/conveyor/build-dispatch-daemon.mjs --dry-run`
  live — the dry-run must show `wip-cap` holding again on the same worker-PR shape as the
  2026-09-29T17:26:28Z incident (openItems reads N/7 filled substantially by worker PRs, not
  builder builds).
- **After (fix):** re-run the same dry-run with the fix in place — `wip-cap` no longer counts the
  worker PRs, and the builder's own held items (4382, 4131, 4319 in the live incident) are planned
  for dispatch instead of held.
- The PR records both dry-run outputs (before/after) verbatim as the live proof, not only the
  unit tests above.

## Follow-ups (out of scope — listed so they are not lost)

- Same own-vs-worker attribution question for `maxOpenPrs` itself, if a future incident shows the
  machine-wide PR volume cap also needs builder-only scoping — deliberately NOT bundled here since
  the operator's 2026-09-29 decision scopes this card to `maxOpenItems` only.
- A shared helper (or module) for "read the builder's own dispatched-item set from its run
  records," if a third caller besides `maxOpenItems`/`maxOpenPrs` turns out to need the same
  attribution — not extracted preemptively here.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs`
   fails on `main` today (new worker-PR-not-counted / builder-PR-counted / dedupe cases) and
   passes after this lands.
