---
bornAs: xbcny9p
kind: story
size: 3
priority: high
status: resolved
scope: ["we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/lib/lane-whois-core.mjs", "we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
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

## Progress

- **Built.** `reclaimFinishedLanes` (we:scripts/conveyor/lane-pool-health-watch.mjs) now skips a
  `finished-reclaimable` candidate WITHOUT calling `reclaimLane` only when the new pure predicate
  `isLaneAlreadyClean` (we:scripts/lib/lane-whois-core.mjs) confirms it is genuinely at rest — zero
  uncommitted/ahead content AND `HEAD` literally at the pool branch's own current tip on the expected branch —
  recording it as `{ reclaimed: false, alreadyClean: true }` instead. A lane that is clean-relative-to-HEAD but
  still BEHIND the tip (or on a stray branch) still gets a real reclaim, per the item's own Risks section.
- we:scripts/lane-whois.mjs now exposes `headSha` / `branch` / `branchTipSha` at the top level of each row (all
  three were already read internally — `branchTipSha` is the one genuinely new, single, cheap `git rev-parse
  <branchRef>` read per lane — negligible next to the ~10-process `reclaim` tree it lets a caller skip).
  `classifyLaneVerdict`'s own verdict rule is intentionally UNCHANGED (still "nothing to lose" ⇒
  `finished-reclaimable`, tip or not) — the distinct-verdict follow-up the spec calls "cleaner" stays a
  separate, optional future item.
- Went slightly beyond the declared `scope:` (added we:scripts/lane-whois.mjs) because the fix cannot be made
  safely without it — the risk the item itself names ("a lane can be clean but checked out at an old commit…
  keep reclaiming when HEAD is not the pool branch tip") is not decidable from data
  we:scripts/conveyor/lane-pool-health-watch.mjs already had; it needed whois to expose the tip comparison.
- Tests: we:scripts/lib/__tests__/lane-whois-core.test.mjs (pure `isLaneAlreadyClean` cases),
  we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs (the item's own 3-lane fixture — clean-at-tip
  skipped / clean-behind-tip reclaimed / dirty-unpreserved untouched — plus the second-pass-zero-calls case and
  a branch-name-guard case), and a real-git integration addition to we:scripts/__tests__/lane-whois.test.mjs
  proving the new fields are exposed and disagree exactly when a lane is clean-but-behind. All new cases
  verified red against pre-fix source, green after.
- Done-when #2 (**Live**) is proven in the PR body via the card's own before/after live-proof plan, not here.
- `/converge` (care: elevated, 1 round, panel + independent red-team) — **land, verdict accept**, all 5 lenses
  (correctness/security/simplicity/standards-conformance/claim-accuracy) accept. Findings surfaced and fixed
  along the way: `isLaneAlreadyClean` and its call site now fail CLOSED (a real reclaim, never a silent skip) on
  a malformed/absent `uncommitted`/`ahead`/`branch` shape, instead of defaulting it to "clean"; added a real-git
  regression test proving we:scripts/lane-pool.mjs `reclaim` genuinely never fetches (the invariant this whole
  fix's safety argument depends on); and the wiring test in we:scripts/__tests__/lane-whois.test.mjs now also
  covers a real stray-branch lane, not just at-tip/behind-tip.
