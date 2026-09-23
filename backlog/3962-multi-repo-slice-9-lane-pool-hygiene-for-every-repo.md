---
bornAs: xr4ygg7
kind: task
parent: "3963"
status: resolved
blockedBy: ["3956"]
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/tick-core.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# Multi-repo slice 9: lane-pool hygiene for every repo

we:scripts/conveyor/lease-reaper.mjs only matches WE session names, so dead leases in the frontierui and plateau pools are reclaimed only by TTL; tick capacity counts only the WE pool (we:scripts/conveyor/tick-core.mjs:1472). Match other repos' fix/review sessions and count capacity per pool.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/lease-reaper.test.mjs we:scripts/conveyor/__tests__/tick-core.test.mjs` fails before this item lands (no `repoFromSession`/`repoKeyForPool`/`fetchPrStatesForRepo` exports on `we:scripts/conveyor/lease-reaper.mjs`, no `lanePoolListArgsForRepo` export on `we:scripts/conveyor/tick-core.mjs`, and the old "never treats a sibling PR as a WE item" assertion — `itemNumFromSession('fix-pa-49')` / `itemNumFromSession('fix-fui-49')` both `null` — still holds) and passes after: a `fix-<tag>-<id>` session now resolves its item number and repo for ANY constellation repo (not just `we`), the PR-terminal reap axis is scoped per repo (`fetchPrStatesForRepo`, one `gh pr list --repo=<slug>` per distinct repo actually held, never one shared always-WE read — closing the exact collision hazard a same-numbered WE/plateau-app PR pair would otherwise create), and `we:scripts/conveyor/tick-core.mjs`'s free-lane read now threads `--repo=<lanePoolRepo>` through (`lanePoolListArgsForRepo`) so tick capacity is counted against the TARGET repo's own pool, not always WE's.
