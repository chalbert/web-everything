---
bornAs: xl5xhmj
kind: story
size: 3
status: open
priority: high
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-28"
tags: ["blocker", "lane-pool", "health-watch"]
---

# Health-watch reclaim resets a live worker's lane when its work is already pushed, bypassing the salvage liveness gate

`we:scripts/lane-pool.mjs#cmdReclaim` only runs the liveness gate (live owner session, process cwd in the
lane, quiet period) inside `cmdReclaimSalvage`, and only enters it when content is NOT preserved. When every
change is already on a remote ref, `reclaim --salvage` skips the gate and runs `git reset --hard origin/main`
plus `git clean -fd` straight away. So an unleased lane whose live worker has just pushed is reset under it.
The health watch's litter reap also deletes the worker's commit-message and PR-body scratch files from such a
lane. Blocker: any lane that loses its lease (see #4371) is reset the moment its work is pushed,
mid-verify or mid-PR.

## Evidence (2026-09-28, lane-18, #4294)

- lane-18 reflog: `16:38:53 commit b01a9b50c` → `16:49:34 reset: moving to origin/main`.
- Health-watch log (review-daemon clone, `.conveyor/lane-pool-health-watch-we.log`) line 76414: lane-18
  verdict `finished-needs-review`, salvage outcome `kept: true`, keptReason
  `owning session is still live (claude agents)` — commit not yet pushed, so the salvage gate ran and kept it.
- Line 76421: `lane-18: reaped litter-only dirty state` naming the worker's PR-body file — deleted while live.
- Lines 76501/76546: verdict `unknown-work` (PR #2861 OPEN), `preserved: true`, outcome `reclaimed: true`,
  log `lane-18: reset — content already on a remote ref, nothing to salvage`. No liveness check on this path;
  the same owner session was live one tick earlier.
- Recurred on lane-21 (#4347, PR #2862): reflog `16:47:24 commit 5df278597` → `17:00:14 reset: moving to
  origin/main`; health-watch log line 76768 `lane-21: reset — content already on a remote ref`. The worker
  restored HEAD by hand at 17:07:41; its untracked scratch files were lost and one reset raced its open-pr.
- Code: `cmdReclaim` enters `cmdReclaimSalvage` only when `(!proof.preserved || hasLitterWorktrees) && flags.salvage`;
  otherwise it falls through to the reset with only a lease check.
- `planSalvageCandidates` in `we:scripts/conveyor/lane-pool-health-watch.mjs` filters on whois
  `row.liveOwner`, which read `false` for lane-18 while the salvage gate's own `liveAgentInLane` read it live —
  the two liveness reads disagree.

## Forks

1. **Where does the liveness gate live?**
   - **Default: run the same gate (`liveAgentInLane` + `pidsWithCwdIn` + quiet period) in `cmdReclaim` for
     every non-override reclaim, preserved or not.** One gate, one place; a pushed lane is still left alone
     while its owner is live.
   - Gate only in the health watch before calling reclaim. Rejected: a manual `reclaim` would still reset a
     live lane.
2. **Litter reap on an unleased lane with a live owner?** **Default: skip it** — apply the same gate before
   `cleanLaneLitter` in the health watch.
3. **Whois `liveOwner` disagreeing with the gate:** **Default: make whois use the same `liveAgentInLane`
   read**, so candidate selection and the gate agree.

## Done when

1. **Executable** — a test for `cmdReclaim` (or its pure core): an unleased lane with a pushed-only commit and a
   live owner session → not reset (`kept`, reason names the live owner); same lane with the owner gone and
   quiet period elapsed → reset.
2. **Live proof** — on a lane whose lease was dropped while its worker is live and has pushed, the next
   health-watch tick logs `KEPT` for it instead of `reset — content already on a remote ref`.
