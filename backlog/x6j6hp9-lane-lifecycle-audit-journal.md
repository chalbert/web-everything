---
kind: story
size: 5
status: open
priority: high
scope: ["we:scripts/lib/lane-history.mjs", "we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/lib/lane-whois-core.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-28"
tags: ["lane-pool", "telemetry", "observability"]
---

# Lane lifecycle audit journal: every lease/reset/reclaim is recorded with its actor

Every state change of a lane appends one line to an append-only per-pool journal: lease write, renew, expire
and delete; acquire, adopt, release, reap; reclaim and salvage; every `git reset` / `git clean` of the tree;
litter deletion; branch switch. Each line carries: timestamp, lane, action, ACTOR (daemon name, script,
session id, pid, parent pid), reason, HEAD before→after, dirty-file count and commits-ahead before the change,
and whether unpushed work existed. A destructive action on a lane with unpushed work is refused unless the
journal proves the owner is gone, and is always logged loudly. `lane-whois --history <lane>` prints the
timeline; health smells flag the two failure shapes; Plateau /wip shows it (daemons panel, #4340).

## Why — what the 2026-09-28 lane-18 / lane-21 investigation needed and could not get

Root causes are #xbk2is9 (reaper reaps hand-briefed leases) and #xl5xhmj (reclaim resets a live pushed lane).
Finding them took a manual join of five sources, because none records the whole story:

1. **Who reset the tree, and when.** Only `git reflog` had the time (`16:49:34 reset: moving to origin/main`),
   with no actor. `cmdReclaim` / `cmdReclaimSalvage` in `we:scripts/lane-pool.mjs` run `git reset --hard` +
   `git clean -fd` and write NO ledger entry; `we:scripts/lib/lane-history.mjs` records only
   acquire/adopt/release/reap (its own header names the four call sites).
2. **Timestamps in daemon logs.** The lease-reaper log and the health-watch log (`lane-pool-health-watch-we.log`,
   239 MB, 76k lines) carry no timestamps. The reset had to be matched to a health-watch tick by line number
   and by the HEAD sha in the whois verdicts.
3. **Actor and reason on release.** lane-18's ledger says `release Mac:40984` — a host:pid, not "lease-reaper,
   reason session-gone". The reason exists only in the reaper's text log, un-timestamped.
4. **Hand-written leases.** Lanes 12/13/14 got leases rewritten by hand (`Mac:<pid>` sessions, 18:15Z) through
   `leaseBody` in `we:scripts/lib/lane-lease.mjs`; no ledger line exists for them, so the ledger still says
   `release` as the last event.
5. **Litter deletion.** The health watch deleted lane-18's PR-body scratch file and lane-21's untracked scratch
   files (`cleanLaneLitter`, `we:scripts/lib/lane-litter.mjs`) with only an un-timestamped text log line.
6. **Before-state.** Nothing records dirty count / commits ahead / unpushed at the moment of a reset; it had to
   be inferred from the whois verdict of the previous tick.
7. **Bounded history.** `appendLaneHistory` trims to `MAX_HISTORY_LINES`; a journal for forensics must not.

## Evidence the journal would have shown directly

- lane-18: acquire 20:06:39Z (`conveyor-4294`) → reaper release 20:16:59Z (session-gone) → litter reap →
  reclaim reset 20:49:34Z (`preserved: true`, 1 ahead, owner `bd616854…` live one tick earlier).
- lane-21 (#4347): acquire/reaper-release four times — 20:09→20:21, 20:22→20:33, 20:35→20:46, 20:46→20:59Z —
  each ~11–12 min after acquire; then health-watch reset 21:00:14Z (`reset — content already on a remote ref`),
  worker restored HEAD at 21:07:41Z.

## Forks

1. **Where does the journal live?** **Default: one append-only JSONL per pool under the coordination root**
   (next to the pool, not inside a lane's `.git`, so a lane reset or re-clone cannot erase it). Rotated by
   size, never trimmed to N lines. Rejected: extending the per-lane `.git/lane-history.jsonl` — it is trimmed
   and lives in the tree being destroyed.
2. **How are call sites covered?** **Default: one `journalLaneEvent()` helper in
   `we:scripts/lib/lane-history.mjs`, called by every mutation point** (acquire, adopt, release, reaper
   `releaseLane`, reclaim, salvage, litter reap, lease write via `leaseBody` writers), plus a
   `check:standards` scan that flags a `git reset --hard` / `git clean` / lease `rmSync` in lane code with no
   journal call next to it.
3. **Refuse destructive action on unpushed work?** **Default: yes — refuse unless the journal shows the owner
   gone** (owner session absent, no live pid in the lane, quiet period passed), and log the refusal loudly.
4. **Timestamps in daemon logs:** **Default: prefix every reaper and health-watch log line with an ISO
   timestamp** as part of this card.

## Done when

1. **Executable** — a test drives acquire → reaper release → reclaim reset on a fixture lane and asserts three
   journal lines, each with actor name + pid, reason, HEAD before→after and dirty/ahead counts.
2. **Executable** — `lane-whois --history <lane>` (in `we:scripts/lib/lane-whois-core.mjs`) prints that timeline.
3. **Health smells** — "destructive action on a lane with unpushed work" and "active worker lane without a
   lease" both fire on a fixture and are wired into the health output.
4. **Live proof** — after landing, the next lane reset in the pool shows up in the journal with its daemon name
   and reason, and on Plateau /wip (#4340 panel).
