---
kind: story
size: 3
parent: "x4v2xe4"
status: open
relatedTo: ["2323", "3625", "x994927"]
scope: ["we:scripts/lane-pool.mjs", "we:scripts/lib/lane-lease.mjs", "we:scripts/lib/__tests__/lane-lease.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Make lane availability count correctly: list --acquirable shares the acquire predicate, and refresh honours --lane per lane

Only 1-2 of about 70 lanes read acquirable on 2026-09-19. Two defects, both confirmed by reading `we:scripts/lane-pool.mjs`, both small. What is NOT measured: how many of the ~70 the fix would recover. The first probe in Done-when records that number before and after, so the claim that Defect 1 explains the low count is tested, not assumed.

## Defect 1 — two answers to "is this lane acquirable?"

`laneDirtyOrAhead` counts `origin/<branch>..HEAD` against the LOCAL `origin/<branch>` ref, with no fetch. Any commit in a lane's HEAD that the local ref lacks makes `ahead > 0`, and `isLaneAcquirable` (`we:scripts/lib/lane-lease.mjs`) treats that as someone's unpushed work and refuses the lane.

- `acquire` auto-pick already knows this is too strict: #2452 (Gap 1) added `aheadIsProvablyPushed`, which checks HEAD against the live remote and treats a provably pushed head as recyclable.
- `list --acquirable` (`cmdList`, the `--acquirable` branch) does NOT: it filters through `laneAcquirableInfo` with the raw `ahead`. That is the read `we:scripts/conveyor/tick-core.mjs` and `we:scripts/readiness/dispatch-plan.mjs` use for `freeLanes`, so the dispatcher plans against a pool that looks nearly empty while `acquire` would succeed.
- Fix: one predicate. `list --acquirable` and `provision --acquirable` use the same provably-pushed relaxation as `acquire`, with the same lazily-taken live-remote snapshot (one `ls-remote`, not one per lane), so the count and the acquire agree. Keep the fail-safe direction: when the remote cannot be reached, a lane with `ahead > 0` stays not-acquirable.

## Defect 2 — `refresh` ignores `--lane` and one bad lane aborts all

`cmdRefresh` iterates `existingLanes(repo)` and never reads `flags.lane`. `refreshLane` calls `fetchOriginPruneWithRetry`, which rethrows any non-transient error, so one lane whose origin is unreachable (an SSH-remote lane, where `git@github.com:` fails) throws out of the loop and the remaining lanes are never refreshed.

- Honour `--lane=N` (refresh exactly that lane).
- Wrap each lane's refresh in its own try/catch: log `lane-N: FAILED (<reason>)`, keep going, and exit non-zero at the end if any lane failed. `provision` shares `provisionLane` → `refreshLane`; apply the same isolation there.

## Why it is in this programme

Lane capacity is step 1 of the landing trigger (#x994927): its budget is "free acquirable lanes". A dispatcher that under-counts lanes throttles itself, and a maintenance command that dies on one lane leaves the pool stale, which is what marked the lanes busy in the first place.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/lane-lease.test.mjs` (plus a `we:scripts/lane-pool.mjs` CLI test if the existing suite has a harness for it) has cases that fail before and pass after: a lane whose HEAD is provably on origin but ahead of a stale local ref counts as acquirable in `list --acquirable`; an unreachable remote keeps such a lane not-acquirable; `refresh --lane=3` touches only lane 3; a fetch failure on one lane still refreshes the others and ends with a non-zero exit.
2. **Probed live** — `node we:scripts/lane-pool.mjs list --acquirable --json` and `acquire`'s auto-pick agree on how many lanes are free on the real pool.
