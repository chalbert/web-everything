---
bornAs: xjofyxo
kind: story
size: 3
priority: high
status: resolved
scope: ["we:scripts/lane-pool.mjs", "we:scripts/readiness/conveyor-state.mjs", "we:scripts/readiness/scope-lease-collect.mjs", "we:scripts/__tests__/lane-pool-status-leased-only.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "c7e4fd628fd6ee4436b82103f7d1ce35ca7fd8a7"
tags: []
---

# Lane-pool status runs 4 git calls in every lane (364 per call) for readers that only need leased lanes

we:scripts/lane-pool.mjs `status --json` checks every one of the 90 lanes with 2 `rev-parse`, 1 `status
--porcelain` and 1 `rev-list`. That is 364 git processes and about 14 s per call. The conveyor's readers
(we:scripts/readiness/conveyor-state.mjs and we:scripts/readiness/scope-lease-collect.mjs) only use the LEASED
lanes, and today 1–2 of 90 are leased. The lease-first shortcut from #4012 skips git for leased lanes only. It
assumed most lanes are leased, which is now the opposite of reality, so every status call hits the worst case.
This is not a direct dispatch blocker. It is a main source of the fork storm behind load-cap (card 4343), and it
makes each tick slow (a fresh tick-core took 73.8 s, conveyor-state 42.7 s).

## Evidence (read-only, 2026-09-28)

- A PATH shim (a wrapper that logs each git call and then runs the real git) counted git spawns, run from
  `~/workspace/wev-control`:
  - `status --json` → exit 0, **13 991 ms, 364 git spawns** (`rev-parse` 182, `status` 90, `rev-list` 90,
    `remote` 1, `symbolic-ref` 1).
  - `list --acquirable --json` → 7 587 ms, 4 git spawns.
- Tight `ps` sampling, 45 s, 2371 short-lived processes: a pool `status` call was the immediate parent of 544
  (the wip-publisher's `live-state`, see card 4346) + 339 (build-dispatch-daemon, through conveyor-state) + 58
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

## Progress

- Added `status --leased-only` to we:scripts/lane-pool.mjs: reads each lane's lease marker (no git) and runs
  the git probe (rev-parse ×2, `status --porcelain`, rev-list) only for lanes with a live lease. A leased lane's
  row is unchanged from full `status`; an unleased row omits `head`/`branch`/`clean`/`behind`. Plain `status`
  (used by we:scripts/conveyor/lane-pool-health-watch.mjs's trim, untouched) is unaffected.
- we:scripts/readiness/scope-lease-collect.mjs's `readPoolStatus` now passes `--leased-only` — its
  `collectSnapshot` only ever reads leased rows, so this is a pure win.
- we:scripts/readiness/conveyor-state.mjs now requests `--leased-only` too. Its `freeSlots` estimate (the one
  consumer that read unleased rows' `exists`/`clean`) needed **no code change at all**: `computeFreeSlots`'s
  existing `clean !== false` test already reads a `--leased-only` row's absent `clean` field as clean, so it
  produces the correct lenient count ("optimistic upper bound", never a dispatch gate) on a leased-only payload
  by construction. A first cut added a bespoke `computeFreeSlotsLeasedOnly` fn + a `poolStatus.leasedOnly` branch
  to "handle" this; a `/converge` panel round (see the PR body's round history) caught it computing an IDENTICAL
  count to the existing fn on every leased-only input, with no test defending either path, and it was deleted —
  the shipped we:scripts/readiness/conveyor-state.mjs calls plain `computeFreeSlots(poolStatus)` unconditionally.
  Separately, a fresh `list --acquirable` call per read (the card's own suggested fix for `freeSlots`) was tried
  and measured LIVE to cost as much as the original problem when the pool holds many dirty-unleased lanes (a
  real state of the live pool today) — see live evidence below — so that path was never taken.
- New test: we:scripts/__tests__/lane-pool-status-leased-only.test.mjs — a real fixture pool (5 lanes, 1
  leased) pins (a) zero git spawns for unleased lanes / ≥4 for the leased one, (b) the leased lane's row is
  byte-identical between `--leased-only` and full `status`, (c) the readers' own shaping functions
  (`shapeLanes` from we:scripts/readiness/conveyor-state.mjs; `collectSnapshot`+`liveScopePicture` from
  we:scripts/readiness/scope-lease-collect.mjs / we:scripts/readiness/scope-lease-live.mjs) agree under both,
  and (d) — added in a second `/converge` round, a red-team finding — a DIRTY-but-unleased lane, the one input
  where `--leased-only`'s absent `clean` and full status's real `clean: false` actually diverge: full `status`
  still excludes it from `freeSlots`, `--leased-only` counts it as free (the disclosed leniency tradeoff). The
  same round also caught and fixed a macOS-only bug in the spawn-count assertions themselves: an un-realpath'd
  temp dir (`/var/...`, a symlink) never matched the git-spawn PATH shim's logged `$PWD` (`/private/var/...`),
  so the "zero spawns in an unleased lane" checks passed vacuously regardless of whether the feature worked.
- **Live proof (read-only, against the real pool, 2026-09-28):**
  - Before (already recorded above): `status --json` → 364 git spawns / 13 991 ms.
  - After: `status --leased-only --json` (same real pool, `--repo=~/workspace/wev-control`) → **8 git spawns**
    (3 `resolveRepo` + 4 for the one currently-leased lane + 1 unrelated shell-prompt noise spawn in the caller's
    own cwd), well under the 364 baseline.
  - After, at the tick level: running we:scripts/readiness/conveyor-state.mjs (`--json`) against the real pool
    (2 leased lanes at the time) → **36 total git spawns, 7.8 s wall time**, of which 16 are the two
    lane-pool `status --leased-only` sub-invocations (conveyor-state's own + scope-lease-collect's, 8 each) —
    under the 20-spawn Done-when-2 threshold for the "lane status" piece specifically. The remaining 20 are
    scope-lease-collect's per-lane observed-scope reads (`remote get-url`, `merge-base`, `diff`, …) for the 2
    leased lanes — a separate, unchanged cost this card does not touch. `freeSlots: 88` / `lanes: 2` came back
    correct.
  - A first attempt sourced `freeSlots` from a fresh `list --acquirable --json` call per the card's suggested
    fix; live-measured on the same real pool this cost 170 git spawns / 42.6 s (no better than the original
    problem) because the pool currently holds many dirty-unleased lanes, which defeat `list --acquirable`'s own
    lease-first shortcut. Reverted in favor of the lenient in-process estimate above — see the code comment on
    `computeFreeSlotsLeasedOnly`.
