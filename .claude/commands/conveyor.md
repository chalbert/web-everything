---
description: Operate the conveyor from this session — a chained-sleep tick loop that dispatches scope-disjoint backlog items into the lane pool as background delivery agents, watches their PRs, and surfaces escalations, while the chat stays conversational (#2612)
---

Invoke the `conveyor` skill (#2613, epic #2612): operate the interim swimlane-progression loop from this live
main session. Confirm the pool size, the per-program conflict policy (default **wait**), and the idle-stop
window (default **15 min**) with the operator, then start ticking.

Each tick reads the whole picture in one call (`conveyor-state.mjs --json`), plans the dispatch
(`dispatch-plan.mjs --json`), spawns **one background delivery agent per launch entry** (the
`delivery-agent-brief.md` template, filled per item) plus a background `pr-watch.mjs <pr>` per in-flight PR
whose **exit** wakes the loop, posts one terse status line, then arms the next
`Bash({ command: "sleep 120", run_in_background: true })` — that chained-sleep exit is the heartbeat, because
`ScheduleWakeup` does not fire mid-run in this extension.

The chat **stays conversational** — you steer readiness here and queue work with
`node scripts/backlog.mjs build-queue add <NNN>`; the conveyor pulls only cleared items and never blocks the
chat. Landing is the **resident drain daemon's** job — this skill never merges; a `review:human` park is
surfaced as **"run `/review`"**. State lives only on the lane board's normal verbs — **no parallel store**.
Idle-stop when the queue is empty with no feedback for the window; a final ledger (delivered / parked /
stranded) on stop. Every script-decidable decision (dispatch, state read, watcher verdict, idle clock, health)
is delegated to the scripts above, per
[we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
(#2607) — judgment (readiness, supervising a build, escalation review) stays with the operator and the agents.

A bare number sets the **pool size** (max parallel lanes), e.g. `/conveyor 4`.

$ARGUMENTS
