---
kind: story
size: 3
priority: high
status: open
scope: ["we:scripts/lane-pool.mjs", "we:scripts/readiness/conveyor-state.mjs", "we:scripts/readiness/scope-lease-collect.mjs", "we:scripts/__tests__/lane-pool-status-leased-only.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "c7e4fd628fd6ee4436b82103f7d1ce35ca7fd8a7"
tags: []
---

# Lane-pool status runs 4 git calls in every lane (364 per call) for readers that only need leased lanes

we:scripts/lane-pool.mjs `status --json` checks every one of the 90 lanes with 2 `rev-parse`, 1 `status
--porcelain` and 1 `rev-list`. That is 364 git processes and about 14 s per call. The conveyor's readers
(we:scripts/readiness/conveyor-state.mjs and we:scripts/readiness/scope-lease-collect.mjs) only use the LEASED
lanes, and today 1–2 of 90 are leased. The lease-first shortcut from #xn432dz skips git for leased lanes only. It
assumed most lanes are leased, which is now the opposite of reality, so every status call hits the worst case.
This is not a direct dispatch blocker. It is a main source of the fork storm behind load-cap (card x45rs01), and it
makes each tick slow (a fresh tick-core took 73.8 s, conveyor-state 42.7 s).

## Evidence (read-only, 2026-09-28)

- A PATH shim (a wrapper that logs each git call and then runs the real git) counted git spawns, run from
  `~/workspace/wev-control`:
  - `status --json` → exit 0, **13 991 ms, 364 git spawns** (`rev-parse` 182, `status` 90, `rev-list` 90,
    `remote` 1, `symbolic-ref` 1).
  - `list --acquirable --json` → 7 587 ms, 4 git spawns.
- Tight `ps` sampling, 45 s, 2371 short-lived processes: a pool `status` call was the immediate parent of 544
  (the wip-publisher's `live-state`, see card xvgqaqg) + 339 (build-dispatch-daemon, through conveyor-state) + 58
  (scope-lease-collect) + 43 + 41 (health-watch for frontierui and plateau-app) of them. That is about 43% of all
  caught spawns.
- One tick-core tick calls status at least twice: conveyor-state L842 calls it directly, and
  we:scripts/readiness/scope-lease-collect.mjs L475 calls it again (scope-lease-collect is run from conveyor-state
  and from we:scripts/readiness/dispatch-plan.mjs L861).
- `state.lanes` from conveyor-state at 08:42 ET had 2 entries (the leased lanes), out of 90 lanes scanned.

## Fix (smallest)

Add `status --leased-only`. It reads each lane's lease marker (no git) and runs the git checks only for lanes with
a live lease. conveyor-state L842 and scope-lease-collect L475 pass the new flag. Keep full `status` for operator
use and for anything that needs dirty-unleased info (lane-pool-health-watch's trim). Before switching them, check
that neither reader uses fields of unleased rows. conveyor-state's `freeSlots` may count them. If so, it can take
the count from `list --acquirable`, which is already cheap.

## Risks

- A reader that quietly depended on unleased rows (for example a dirty-unleased count in health) would lose them.
  The test below pins each reader's output on a mixed fixture.

## Test plan (each fails before the fix)

- A fixture pool with 5 lanes, 1 leased: `status --leased-only --json` spawns git only in the leased lane (counted
  via an injected git runner or a PATH shim), and returns the same row for it as full `status`.
- conveyor-state's `lanes` and scope-lease-collect's `leases` are identical under `--leased-only` and under full
  status on the same fixture.

## Live proof plan

Before: the shim count above (364 git, 14 s per call) and the tick timing (conveyor-state 42.7 s). After landing:
the same shim count on `status --leased-only --json` shows about 4 git per leased lane. A fresh
we:scripts/conveyor/tick-core.mjs run (`{"bookkeeping":{}}`) is measurably faster, and its `state.lanes` is
unchanged. The builder's own `--dry-run` from `~/workspace/wev-control` gives the same verdicts, sooner.

## Done when

1. **Executable** — vitest on we:scripts/__tests__/lane-pool-status-leased-only.test.mjs passes and fails on main.
2. **Live** — a tick-core tick spawns under 20 git processes for lane status on a pool with 2 leased lanes.
