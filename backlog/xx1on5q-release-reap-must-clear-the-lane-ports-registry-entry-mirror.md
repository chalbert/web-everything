---
kind: task
tier: pinned
parent: "3383"
status: open
dateOpened: "2026-09-03"
tags: [conveyor, lane-pool, lane-ports, ground-truth, reap]
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs"]
relatedTo: ["3435", "3449", "3457"]
---

# Release/reap must clear the lane-ports registry entry, mirroring acquire's write

we:scripts/lane-pool.mjs acquire writes an item->lane entry into we:.claude/lane-ports.json (registerItemsToLane), and cmdAcquire/cmdRefresh/cmdRemove already call unmapLanes to clear it on reset/refresh/remove -- but cmdRelease (the release command, and the lease-reaper's reclaim path which shells out to it) never does. A released or reaped lane keeps its stale item mapping forever, so we:scripts/readiness/conveyor-state.mjs's building count overcounts and can suppress real dispatch.

## The bug, traced to real call sites, not assumed

`we:.claude/lane-ports.json` (gitignored, per-checkout operational state — `{ "<num>": { lane, port?, repo? } }`) maps a backlog item to the lane currently working it. It is read live, every tick, by `we:scripts/readiness/conveyor-state.mjs`'s `laneItemMap()` (`we:scripts/readiness/conveyor-state.mjs:660-662`, `LANE_PORTS_PATH` at line 604) to drive the health-stall scan and, via the reverse map, the tick status line's `building` count (`we:scripts/conveyor/tick-core.mjs:~737`: `building = buildGuardNums ∪ buildLaneNums`).

**Where it's written.** `registerItemsToLane()` (`we:scripts/lane-pool.mjs:409-419`) is the one shared writer. It's called from exactly two places:
- `cmdAcquire`, when `--item=NNN` is passed (`we:scripts/lane-pool.mjs:1170`), immediately preceded by its own `unmapLanes(repo, [chosen])` (`we:scripts/lane-pool.mjs:1169`) to drop any stale entry already pointing at the lane about to be reused.
- `cmdMap` (`we:scripts/lane-pool.mjs:1494`), the standalone `map` command.

**Where it's cleared — and where it isn't.** `unmapLanes()` (`we:scripts/lane-pool.mjs:392-398`) is called on every path that changes what a lane is doing:
- `cmdRefresh`, both the reset branch and the skip branch (`we:scripts/lane-pool.mjs:762`, `we:scripts/lane-pool.mjs:779`).
- the ghost-reclaim backstop inside `cmdAcquire` itself, when it reaps a provably-dead lease before selecting a lane (`we:scripts/lane-pool.mjs:940`).
- `cmdAcquire`'s own reset-before-remap step (`we:scripts/lane-pool.mjs:1148`, `we:scripts/lane-pool.mjs:1169`).
- `cmdRemove` (`we:scripts/lane-pool.mjs:1439`).
- `cmdUnmap`, the standalone `unmap` command (`we:scripts/lane-pool.mjs:1504`).

**`cmdRelease` (`we:scripts/lane-pool.mjs:1292-1372`) is not on that list.** Read end to end: it validates ownership/contested-lease rules, then does exactly one mutating thing — `rmSync(LEASE_MARKER(dir), { force: true })` (`we:scripts/lane-pool.mjs:1367`) — and returns. No call to `unmapLanes` anywhere in the function. A lane released the normal way (`we:scripts/lane-pool.mjs release --lane=N`) keeps whatever item the registry still says it's working, forever, until some *later* `acquire`/`refresh`/`remove`/`map`/`unmap` on that same lane happens to clear it.

**The reaper inherits the same gap, not a separate one.** `we:scripts/conveyor/lease-reaper.mjs`'s IO shell reclaims a dead lease by delegating to `we:scripts/lane-pool.mjs release --pool=<name> --lane=<n> --force` (per its own header comment: "so the reserved-lane protection lives in ONE place — this reaper never rm's a marker directly") — confirmed by grep: `we:scripts/conveyor/lease-reaper.mjs` contains no reference to `unmap`, `lane-ports`, `LANE_PORTS`, or `registerItemsToLane` at all. Since it calls the same `cmdRelease` that never touches the registry, every reclaim the reaper performs leaves the stale mapping behind too.

## Live evidence

**Tick-1 evidence (2026-09-03T09:31, reported by the operator, not re-derived here).** The mechanical-dispatcher prototype runner (`/Users/nicolasgilbert/workspace/wev-scratch-dispatcher-4`) was restarted at 2026-09-03T09:31 — a clean restart to load an unrelated fix. At tick 1, before the fresh process could have dispatched anything itself, the status line already read `"8 building"`. `we:.claude/lane-ports.json` at that moment held 5 stale entries (`2831`→lane 12, `3398`→lane 16, `3448`→lane 23, `3451`→lane 27, `3452`→lane 26), none matching the real leased lanes (`we:scripts/lane-pool.mjs status --json` showed only 2 real leases, on different lane numbers). All 5 items were already independently confirmed resolved/done hours earlier. By tick 15 the phantom count had grown to `"15 building"` while real leased lanes stayed at 2 — new phantom guard entries accumulate on top, but the persisted file is the seed: with a genuinely fresh in-process bookkeeping state, the only possible source for a non-zero `building` count before any dispatch is this file.

**Independently reconfirmed fresh, tonight, from the primary checkout (not just the operator's report — checked directly before filing this card).** The operator's earlier manual `{}` clear of `we:.claude/lane-ports.json` (a one-off unblock, not a fix) has since been silently re-populated with fresh staleness, which is itself further live proof of the gap. `we:.claude/lane-ports.json` currently holds:

- `"3398": { port: 3150, lane: 5,  repo: "web-everything" }`
- `"3401": { port: 3210, lane: 11, repo: "web-everything" }`
- `"3437": { port: 3280, lane: 18, repo: "web-everything" }`

A fresh `we:scripts/lane-pool.mjs status --json` shows only two lanes actually leased right now: lane 20 (`fix-1851`, `conveyor-fix`) and lane 22 (`fix-1861`, `conveyor-fix`). Lanes 5, 11, and 18 — the ones the registry claims are working items 3398/3401/3437 — are all free. `#3401` and `#3437` are both `status: resolved`; `#3398` is `status: open` but its lane-5 lease is gone. Every one of these three entries is a `release` (or reaper-driven reclaim) that dropped the lease marker without dropping the registry entry — the exact gap traced above, caught live a second time independently of the operator's tick-1 report.

## Net effect

The stale registry makes the tick status line lie about real capacity, and — more importantly — makes `building` an overcount that can suppress the runner's own willingness to dispatch further queued work when it believes it's already near-saturated, even when real lane-pool capacity is nearly empty (2 of 42 leased was the real figure while `building` read 15 at tick 15 in the operator's report).

## Likely fix shape (not over-prescribed)

Mirror the write: `cmdRelease` (`we:scripts/lane-pool.mjs:1292-1372`) should call `unmapLanes(repo, [n])` for each lane it actually releases (inside the `for (const n of targets)` loop, right alongside the existing `rmSync(LEASE_MARKER(dir))` at `we:scripts/lane-pool.mjs:1367`), the same way `cmdRemove`/`cmdRefresh`/the acquire-time ghost-reclaim already do. Because the reaper (`we:scripts/conveyor/lease-reaper.mjs`) reclaims by shelling out to `we:scripts/lane-pool.mjs release ... --force`, fixing `cmdRelease` alone should close the gap for both the manual-release and the reaper-reclaim path — worth confirming as part of the fix, not assuming.

This is a forced-invariant bug fix (the acquire-time write already establishes the registry-must-mirror-reality contract; release/reap breaking that mirror is a defect, not a legitimate alternative design) — `kind: task`, not `kind: decision`, per this repo's own fork-existence test (no genuinely coherent alternative where a released/reaped lane keeps claiming to hold an item).

## Done when

1. **Executable** — a test reproducing the exact shape above: `acquire --item=N` on some lane, `release --lane=<that lane> --force`, then assert `we:.claude/lane-ports.json` no longer has an entry for `N` (or, for the reaper path, a reaped stale lease's item is likewise cleared from the registry).
2. `cmdRelease` (and, if it needs its own fix rather than inheriting `cmdRelease`'s, the reaper's reclaim path) clears the lane-ports registry entry for every lane it actually releases/reclaims — confirmed by re-reading the fixed code, not just the new test passing.
3. A fresh `we:scripts/lane-pool.mjs status --json` cross-checked against `we:.claude/lane-ports.json` after a real release/reap shows no orphaned entries (the live check this card's own evidence section ran, repeated post-fix).
