---
bornAs: xqmw8g9
kind: epic
parent: "3383"
status: open
dateOpened: "2026-09-24"
relatedReport: reports/2026-09-24-health-daemon-design.md
tags: [conveyor, daemons, incident-2026-09-24, health-daemon, hardening]
---

# Conveyor hardening — 2026-09-24 incident follow-ups

Tracking epic for every improvement surfaced by the 2026-09-24 conveyor incident day. Operator, 2026-09-24
~6:25 PM ET, verbatim: "Make sure you track all improvement. In general we should prioritize the automated
health daemon that listen to multiple smell and auto dispatch investigations if needed and can tell me what
it think we should do without needing a session".

This card is the durable list. Chat is not. Every improvement named that day is either a child card below
(filed with `parent: 4075`) or an existing card/PR linked from the tables below. Status is as of
2026-09-24 6:25 PM ET.

## TOP PRIORITY — the automated health daemon

A resident daemon that probes many cheap "smells", auto-dispatches a diagnose-only investigation when one
fires, and writes the operator a recommendation without needing a chat session. Design report:
`we:reports/2026-09-24-health-daemon-design.md`.

| Card | What | State |
| --- | --- | --- |
| **4065** | Decision: the health daemon design (prepared, ready to ratify) | open, prepared |
| 4077 | Slice 1 — smell framework + 3 seed smells + recommendation channel | open, blocked by 4065 |
| 4078 | Slice 2 — auto-dispatch a diagnose-only investigation per episode | open, blocked by 4065 |
| 4068 | Slice 3 — daemon-code smells (clone behind, self-sync conflict, smoke gate, stale bindings, drain pass) | open, blocked by 4065 |
| 4066 | Slice 4 — queue and host smells (PR stalls, over limit, labels, stood-down, lane pool, load, App token) | open, blocked by 4065 |
| 4079 | Slice 5 — a finding becomes an uncleared card through a filing request landed in a lane | open, blocked by 4065 |
| 4081 | Slice 6 — watch the watcher (#4045's outside check reads the last-tick stamp + queue header) | open, blocked by 4065, #4045 |
| 4067 | Live daemon status page (reads the same probe results) | open, blocked by 4065 |
| 4080 | Daemon-level stall alerts (macOS notification per high-severity episode) | open, blocked by 4065 |

The build slices are filed with `--queue=false`. They are cleared to the conveyor when 4065 is ratified,
so no slice is built against an unratified design.

## Newly filed on 2026-09-24 (children of this epic)

| Card | What | Kind |
| --- | --- | --- |
| 4070 | Sweep: turn prose rules in dispatched agent briefs into mechanical code | story |
| 4062 | Worktree-based lanes instead of full clones | investigation |
| 4060 | Daemon fixes are built by the conveyor, not by in-chat workers | decision |
| 4071 | Cost tracking per daemon and per bot | story |
| 4076 | Cap bot concurrency by machine load | story |
| 4064 | gh throttle inside the gh App shim (after PR #2600, merged) | story |
| 4072 | Live smoke gate's gh check must run with a dispatched session's environment | story |
| 4084 | Lane-pool litter allowlist misses `.fix-*`, `tmp/`, `.prep-*.md`, `-plateau` scratch | story |
| 4059 | Remote Control offline session entries pile up (Anthropic-side, ask upstream) | task |
| 4082 | Operator-pending policy calls: retention days, stuck-bot timeout, cleanup scope, API key, auto-resume | decision |
| 4061 | Audit log: emergency manual steps taken on 2026-09-24 | task |

## In progress on 2026-09-24 — linked, not duplicated

| Improvement | Card(s) / PR(s) | State at 6:25 PM ET |
| --- | --- | --- |
| Stateful daemon scenario simulator + adversarial coverage | **no card found** on main, open PRs, remote branches or lane working trees | in progress in a chat worker; that worker files its card with `parent: 4075` |
| Multi-instance / multi-Mac daemons + probation (decision prep) | #3615 (epic), #3639 (decision), #4010 (probation decision), #4011 | open; prep running |
| Plateau observability review | xee72b2 (pr-ownership read), xqjl5lf (/wip Fleet panel), #4051 (heartbeat revision) | xee72b2/xqjl5lf uncommitted in a worker lane |
| Lane history + `whois` + reclaim of finished lanes | 4058 (PR #2608), xer3jlp (uncommitted in a worker lane), #3407 | PR #2608 open |
| Open-PR backpressure limit with global/per-PR overrides | x55tmjy | active, uncommitted in a worker lane |
| Stale live-process bindings + hung sessions + mechanical completion records | 4085 (PR #2609); prior: #3296, #3436, 4013 (PR #2555) | PR #2609 open |
| Drain slow passes + stacked PR closed when its base merges (#2578 recovery) | **no card found** for the slow passes; related: 4063 (PR #2587, stacked-base fresh detection), xqzxroq (PR #2581, merged) | in progress in a chat worker |
| Overlay chain from #3681 | #4041 / 4041 (PR #2578), #4044 / 4044, #4002 / 4002, #4040, #4042, #4045, #4046, #4047, #4048, #4049, #4050, #4051, #4052, 4074 (PR #2607) | open |
| Decision: review daemon running a live overlay vs independent review | #4043 / 4043 | open, unprepared |
| Conflict watch can't delete its own superseded stand-down marker | #4025 / 4025 | open |
| Heavy-admission vitest hook miscounts files (single-file run refused as "3 files") | PR #2588 ("vitest guard file count") | open; fix already written, no new card |
| Lane acquire eligibility, vanished-lane crash | 4069 (PR #2602), 4073 (PR #2599) | open |

The existing cards above keep their current parent. They are linked here, not re-parented, so this epic
does not rewrite cards that open PRs are also editing.

## Done when

1. **Executable** — no card under `we:backlog/` with `parent: "4075"` is still `status: open` or
   `status: active` (every child resolved or withdrawn), and each row of the in-progress table points at a
   resolved card or a merged PR.
