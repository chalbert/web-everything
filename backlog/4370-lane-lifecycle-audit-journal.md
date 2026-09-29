---
bornAs: x6j6hp9
kind: story
size: 5
status: active
priority: high
scope: ["we:scripts/lib/lane-history.mjs", "we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/lib/lane-whois-core.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-29"
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

Root causes are #4371 (reaper reaps hand-briefed leases) and #4372 (reclaim resets a live pushed lane).
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

## Progress

- [x] **Journal core** — `we:scripts/lib/lane-history.mjs`: `journalLaneEvent()` appends to
  `<poolDir>/.lane-journal.jsonl` (a pool dot-entry, next to the lanes; rotated aside by size, never trimmed
  or deleted). Each line: `ts`, `lane`, `action`, `actor` (`name` = the daemon declared via
  `LANE_JOURNAL_ACTOR` else the script, plus `script`+subcommand, `session`, `pid`, `ppid`, `host`), `reason`,
  `headBefore`→`headAfter`, `dirtyBefore`, `aheadBefore`, `unpushedCommitsBefore`, `unpushed`. `readLaneJournal`
  reads across rotations; a repeated identical refusal is written once (`unlessRepeat`).
- [x] **Call sites** (`we:scripts/lane-pool.mjs`) — `acquire` (+ `acquire-reset`), `reserve`, `adopt`,
  `release` (+ `litter-delete` of release-time scratch), `release --all-pools`, acquire-native `reap`,
  `lease-expire` (stale lease taken over), `refresh-reset`, `reclaim-reset`, `salvage-reset`, `reclaim-refused`,
  `trim-remove`. The lease-reaper spawns `release` with `LANE_JOURNAL_ACTOR=lease-reaper` and
  `--reason=<classification>`; the health watch spawns `reclaim` with `LANE_JOURNAL_ACTOR=lane-pool-health-watch`
  and `--reason=<pass>`, and journals its own litter reaps.
- [x] **Fork 3 — refusal** — `destructiveActionVerdict()` is the single rule at the reclaim reset: unpushed
  work is destroyed only when the owner is proven gone (liveness gate) or under the operator `--override`;
  both are journalled `loud` (and echoed to stderr); a refusal is journalled `loud`. `refresh --force` stays an
  operator override (existing #2267 contract) but is journalled `loud` when it destroys unpushed work.
- [x] **Fork 2 — standards scan** — `findUnjournaledLaneMutations` (`check:standards` 6f-i-d) flags a
  `git reset --hard` / `git clean` / lease-marker `rmSync` in lane code with no journal call within 15 lines
  (`// journal-exempt: <why>` for the two legitimate cases: the pool-root sibling clone, and undoing a refused
  acquire's own claim).
- [x] **Fork 4 — timestamps** — every lease-reaper and lane-pool-health-watch stderr line is ISO-prefixed
  (`we:scripts/lib/log-timestamp.mjs`).
- [x] **Done-when 1** — `we:scripts/__tests__/lane-pool-lifecycle-journal.test.mjs` drives a real acquire →
  the reaper's own `releaseLane` → the health watch's own `defaultReclaimLane` on a fixture pool and asserts the
  three lines (actor name + pid/ppid, reason, HEAD before→after, dirty/ahead).
- [x] **Done-when 2** — `lane-whois --history <lane>` in `we:scripts/lane-whois.mjs` (renderer
  `formatLaneTimeline` in `we:scripts/lib/lane-whois-core.mjs`; `--json` for raw entries).
- [x] **Done-when 3** — smells `lane-destructive-unpushed` (probe `laneJournal`, the recent journal tail) and
  `lane-worker-without-lease` (the health watch now emits `workerWithoutLease` right after `health` on its tick
  line; `probeLanePools` lifts it) — both fire on fixtures and are wired into
  `we:scripts/conveyor/health-watch.mjs#tick`.
- [ ] **Done-when 4 — live proof** — after landing: the next pool reset shows in the journal with its daemon
  name and reason. Showing it on Plateau /wip is the #4340 daemons panel's job (it reads this journal); not
  built in this card.
