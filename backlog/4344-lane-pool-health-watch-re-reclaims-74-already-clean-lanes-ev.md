---
bornAs: xbcny9p
kind: story
size: 3
priority: high
status: open
scope: ["we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/lib/lane-whois-core.mjs", "we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "c7e4fd628fd6ee4436b82103f7d1ce35ca7fd8a7"
tags: []
---

# lane-pool-health-watch re-reclaims ~74 already-clean lanes every 2-minute pass in each of 3 repos

Every lane-pool-health-watch pass (every 120 s, one resident daemon per repo: we, frontierui, plateau-app) runs
we:scripts/lane-whois.mjs `--json` over the whole pool. It then runs we:scripts/lane-pool.mjs `reclaim --lane=N`
for every lane verdicted `finished-reclaimable`. That verdict also covers a lane with no lease, no uncommitted
files and no commits ahead, which is already clean. So the same ~74 clean lanes are "reclaimed" again every pass.
Each reclaim is a node process plus about 10 git processes (status, reset, clean and more). This is the largest
single source of the host's fork storm, which drives sys time and the load-cap holds (card 4343). It is not a
direct dispatch blocker.

## Evidence (read-only, 2026-09-28 08:46–09:00 ET)

- The last `we` pass in the review-daemon clone's `.conveyor/lane-pool-health-watch-we.log`: `reclaim.outcomes`
  shows **74 × `reclaimed: true`, reason "no uncommitted/ahead content — nothing to lose"**, plus 6 refused.
  Pool health on the same line: total 90, leased 1, acquirable 75.
- The whois report run by hand at 08:55 ET: 74 `finished-reclaimable`, 7 `finished-needs-review`, 8
  `unknown-work`, 1 `in-use`. It took 50.8 s wall. The sample row (lane-2) has `uncommitted` 0/0 and
  `ahead.count` 0, so it is already clean.
- Tight `ps` sampling, 45 s, 2371 short-lived processes attributed by parent chain: health-watch-we **21.3%**,
  health-watch-plateau-app **12.5%**, health-watch-frontierui **5.1%**. Together that is 38.9% of all spawns. The
  top immediate parent was the pool `reclaim` command (450 + 110 children). Reclaim targets seen in those 45 s:
  lanes 13, 14, 32, 33, 35, 36, 38, 41–44, 47–49, 52, 57, 59, 61 and more, about 9–11 children each.
- 4-minute 1 Hz sample, CPU seconds by daemon tree: the three health-watch trees used 36.9 + 27.4 + 20.1 = 84.4
  CPU-s. Each pass's whois also runs a `grep -hF -f lanes.txt` over recent transcripts under `~/.claude/projects`
  (15–17 CPU-s per grep, seen in 4 separate passes).
- Cadence: we:skills-src/conveyor/daemon-manifest.mjs L29 `DEFAULT_PASS_INTERVAL_MS = 120_000`.

## Cause (code)

- we:scripts/lib/lane-whois-core.mjs L104–106: `!hasContent` → `finished-reclaimable` for a lane that has nothing
  to reclaim.
- we:scripts/conveyor/lane-pool-health-watch.mjs L426: `candidates = whois.lanes.filter(verdict ===
  'finished-reclaimable')`, then `reclaimLane` for each one, every pass.

## Fix (smallest)

At we:scripts/conveyor/lane-pool-health-watch.mjs L426, skip rows whose `uncommitted` counts and `ahead.count` are
all 0 and whose checkout is already at the pool branch tip (whois already reads this, so no new git is needed).
Record them as `already-clean` in the outcome instead. A cleaner follow-up: give whois a distinct verdict
(`idle-clean`) so no consumer mistakes "nothing to lose" for "needs a reclaim". Optional second step: skip the
transcript grep when no lane needs attribution. The grep only feeds `unknown-work`/`needs-review` rows.

## Risks

- A lane can be clean but checked out at an old commit or on a stray branch. Reclaim also re-points it. Keep
  reclaiming when HEAD is not the pool branch tip or the branch name is wrong. Only exact-tip clean lanes are
  skipped.
- Reclaim also cleans litter files that the porcelain allowlist ignores. Trim/litter-reap already handles litter
  on the same pass, so check that this path still covers it.

## Test plan (each fails before the fix)

- A whois report with 3 lanes: clean at tip, clean but behind tip, and dirty-unpreserved. `reclaimFinishedLanes`
  calls `reclaimLane` only for the behind-tip lane, and reports the clean one as `already-clean`.
- A second pass over the same fixture after a reclaim makes zero `reclaimLane` calls.

## Live proof plan

Before (above): 74 `reclaimed: true` "nothing to lose" per `we` pass, and the health-watch trees are 38.9% of
spawns. After landing (the resident pass self-syncs): the next pass log shows `reclaimed: true` only for lanes that
changed, and `already-clean` for the rest. Rerun the same tight `ps` attribution (45 s). The health-watch share
should drop well below 10%, and the host-sampler's median `sys_pct` over the next hour should fall below today's
39%. Then run the builder's own `--dry-run` from `~/workspace/wev-control` and record whether `load-status` still
holds.

## Done when

1. **Executable** — vitest on we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs passes with the new cases, which fail on main.
2. **Live** — a resident `we` pass reclaims 0 lanes that were already clean at tip.
