---
bornAs: xbk2is9
kind: story
size: 3
status: open
priority: high
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-28"
tags: ["blocker", "lane-pool", "lease-reaper"]
---

# Lease reaper session-gone axis reaps hand-briefed delivery leases 10 minutes after acquire

A delivery agent started by hand (an in-process Agent-tool subagent, not `claude --bg`) follows
`we:skills-src/conveyor/delivery-agent-brief.md` and acquires with `--session=conveyor-<N>`. That name
matches the dispatcher grammar, so `we:scripts/conveyor/lease-reaper.mjs#sessionGoneForLease` looks it up in
`claude agents --json --all`. An in-process subagent is never listed there. Once the 10-minute grace passes,
the reaper reads "never listed" as "gone" and releases the lease while the agent is still working. The lane
is then unleased with live work in it, which exposes it to the health-watch reset (see #4372) and to a
second acquire. Blocker: it strips protection from live work on every hand-briefed dispatch.

## Evidence (2026-09-28, measured)

- lane-18 lane-history ledger: `20:06:39Z acquire conveyor-4294` (ownerSession `bd616854…`, a live
  interactive session) → `20:16:59Z release Mac:40984`. Reaper log (review-daemon clone,
  `.conveyor/lease-reaper.log`): `reaped web-everything/lane-18 (session-gone; was session conveyor-4294)`.
- Same shape, same ~10–12 min gap, today: lane-5 (`conveyor-4337` 14:17→14:28Z), lane-12 (`conveyor-4349`
  17:11→17:22Z), lane-13 (`conveyor-4344` 17:12→17:24Z), lane-14 (`conveyor-4345` 17:38→17:49Z), lane-16
  (`conveyor-4290` 17:36→17:47Z), lane-17 (`conveyor-4360` → 20:16:58Z), lane-20 (`conveyor-4317` → 20:21Z),
  lane-22 (`conveyor-4291` → 20:33Z). lane-21 (`conveyor-4347`, PR #2862) was reaped FOUR times as its worker
  kept re-acquiring: 20:09→20:21, 20:22→20:33, 20:35→20:46, 20:46→20:59Z (reaper log lines 3582–3606). This explains the 1:30 PM `lane-pool status` showing no leases while
  workers were active in 12/13/14/16.
- Leases acquired under a non-dispatcher name (e.g. lane-8 `pin-and-role-card`, lane-12 `rescope-gh-budget`)
  were NOT reaped — `sessionGoneForLease` returns `null` for them.
- Not the pid: the lease `pid` (63087 on lane-18) is the short-lived acquire CLI; `pidAliveForLease` is
  dormant ("today's leases carry no durable per-agent pid"). The session-name lookup is the only trigger.
- The lease already carries the right liveness key: `ownerSession`/`workerSession` = `bd616854…`, which the
  `reclaim --salvage` gate in `we:scripts/lane-pool.mjs` (`liveAgentInLane`) found live at the same time
  ("owning session is still live (claude agents)").

## Forks

1. **What proves a hand-briefed lease's owner is alive?**
   - **Default: check `workerSession`/`ownerSession` against the same `claude agents` listing (the reclaim
     salvage gate's `liveAgentInLane`) before declaring session-gone.** Uses a key the lease already has;
     reaper and reclaim then agree on liveness.
   - Stop hand-briefed agents from using the `conveyor-<N>` grammar (brief change only). Rejected as the only
     fix: any agent can reuse the grammar again, and the reaper stays wrong.
   - Heartbeat file refreshed by the worker. Rejected: needs every worker to remember to beat.
2. **Brief side:** also have the brief tell a hand-briefed run to pass a non-dispatcher `--session`?
   **Default: no** — fix the reaper; keep one brief.

## Done when

1. **Executable** — a unit test under `we:scripts/conveyor/__tests__/` for the reaper: a lease with
   `session: conveyor-4294`, acquired 30 min ago, absent from the listing, whose `workerSession` IS listed and
   live → `sessionGoneForLease` is not `true`; the same lease with its `workerSession` also absent → `true`.
2. **Live proof** — a hand-briefed delivery agent holds its lane lease past 15 minutes with the reaper running
   (lane-history shows no `release Mac:<reaper-pid>` before the agent's own release).
