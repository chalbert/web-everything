---
bornAs: x0jgunh
kind: story
size: 3
priority: high
status: open
scope: ["we:scripts/conveyor/tick-core.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "c7e4fd628fd6ee4436b82103f7d1ce35ca7fd8a7"
tags: []
---

# BLOCKER: build daemon counts tick-core's own proposed spawns as in-flight builds, so its cap holds every build

The build-dispatch daemon treats tick-core's `counts.building` as "builds already in flight". But that count
includes the guards tick-core just created for THIS tick's own `spawnBuilds`. So when tick-core proposes N
builds and N is at or above the daemon's cap, the daemon sees "N in flight", has 0 slots, and holds all N as
`cap`. It never dispatches. This is why nothing has been built since the kill switch was lifted.

## Evidence (read-only, 2026-09-28 08:30–09:00 ET)

- Daemon log (`~/workspace/.operations/coordination/build-dispatch-daemon.log`): 207 ticks from
  2026-09-27T23:20Z to 2026-09-28T12:43Z, **0 dispatched**. Hold rules seen: `landing-freeze` (kill switch file,
  last at 10:27Z), then only `cap`. In every `cap` tick `inFlight` is `[]`, and the "N building" in the status
  line equals the number of held candidates (or that +1).
- Builder's own dry run, 12:57Z (we:skills-src/conveyor/build-dispatch-daemon.mjs `--dry-run`, from
  `~/workspace/wev-control`): `open PRs: none · durable in-flight builds: none · tick core counts 7 building`,
  `would dispatch now: nothing`, and each of the 7 launchable items held `[cap] 7 builds in flight (cap 3)`.
- A fresh tick with empty bookkeeping (we:scripts/conveyor/tick-core.mjs fed `{"bookkeeping":{}}`, 08:43 ET)
  returned 6 `spawnBuilds` and `counts.building` = 6. Only 2 lanes were leased (`state.lanes`: lane-1
  `soak-break-2835`, lane-2 `review-2837`, both `num: null`), so all 6 "building" are the tick's own proposals.

## Cause (code)

- we:scripts/conveyor/tick-core.mjs L1283–1284: `newBuildGuards` (this tick's spawns) are appended into
  `liveBuildGuards`. L1296 derives `countableBuildGuards` from that. L1536 `computeTickCounts({ liveBuildGuards:
  countableBuildGuards, … })` counts them as `building`. That is right for the interactive conveyor, which
  launches every spawn it is handed. It is wrong for a consumer that picks a subset.
- we:skills-src/conveyor/build-dispatch-daemon.mjs L150: `externalBuilding = Number(d.counts?.building)`, passed to
  `planBuildDispatch` (we:scripts/conveyor/build-dispatch-policy.mjs: `busy = max(running, externalBuilding)`,
  `slots = maxConcurrentBuilds - busy`). The daemon's candidates are counted twice: once as busy, once as
  candidates.
- Bookkeeping is **not** the cause. `settleBookkeeping` (daemon L74–88) correctly drops guards for spawns it did
  not launch, so nothing carries over between ticks. The inflation happens inside a single tick.

## Fix (smallest)

1. tick-core: also emit `counts.buildingInFlight`. Compute it with the same `computeTickCounts`, but from the
   guards that were live BEFORE this tick's spawns (`buildLive`, after the same TTL filter as
   `countableBuildGuards`), plus leased build lanes. Leave `counts.building` and the status line unchanged for
   the interactive conveyor.
2. daemon L150: read `d.counts?.buildingInFlight ?? d.counts?.building`.

## Risks

- A durable-floor guard (`lane: null`) for a genuinely running build must still count. It is in `buildLive`, so
  it does.
- Some double-dispatch protection might have leaned on the inflated count. The daemon's claim, its `inFlight`
  (claims and run records) and tick-core's `filterLaunches` all still guard against a double dispatch. The policy
  dedups candidates that are already in flight.

## Test plan (each fails before the fix)

- tick-core: with empty bookkeeping, 2 leased lanes with `num:null` and 6 launchable, `counts.buildingInFlight`
  is 0 and `spawnBuilds.length` is 6.
- tick-core: a prior-tick build guard whose lane is leased counts 1 in `buildingInFlight`.
- daemon `runBuildDispatchTick` with a fake `planTick` returning 6 spawns and `counts:{building:6,
  buildingInFlight:0}`, cap 3: `plan.dispatch.length` is 3, not 0.

## Live proof plan

Before (captured above): the dry run shows `would dispatch now: nothing`, with every item held
`[cap] 7 builds in flight (cap 3)`, no open PRs and no in-flight builds. After landing (the daemon self-syncs),
rerun we:skills-src/conveyor/build-dispatch-daemon.mjs `--dry-run` from `~/workspace/wev-control`. It must show
`tick core counts 0 building` (or only real in-flight builds), and `would dispatch now:` must list items up to
the cap. Then confirm that the live daemon log shows a tick with a non-empty `dispatched`. If load-cap (card
4343) is holding at that moment, the dry run shows 0 `spawnBuilds`. In that case rerun once
we:scripts/readiness/heavy-admission.mjs `load-status` reports `held:false`.

## Done when

1. **Executable** — vitest on we:scripts/conveyor/__tests__/tick-core.test.mjs and we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs passes with the new cases, which fail on main.
2. **Live** — the builder's own `--dry-run` from `~/workspace/wev-control` lists items under `would dispatch now`.
