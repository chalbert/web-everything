---
bornAs: xxa7f8p
kind: story
size: 5
parent: "2612"
status: open
blockedBy: ["2609", "2611"]
dateOpened: "2026-07-22"
tags: [conveyor, skill]
---

# The /conveyor skill + command

The thin skill markdown + `we:.claude/commands` entry that operates the conveyor (#2612) from the main session. Thin by design: every decision with a right answer is delegated to the scripts it shells — the dispatch-plan script (#2609) and the tick state-read script (#2611), which block this item — per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](docs/agent/platform-decisions.md#deterministic-core-thin-judgment). The skill keeps only the judgment and the conversation.

## What the skill does

- **Conversational arc:** start → confirm pool size + policies with the user → run.
- **Tick loop:** state-read script → dispatch-plan script → spawn one background delivery agent per launch entry (#2608 brief) → **one-line status per tick** (per the progress-tracking preference: the checklist is the progress channel, prose stays quiet).
- **Watcher spawning:** one merge watcher per in-flight PR (#2608) so a merge/park wakes the session instantly and the freed lane is re-dispatched the same turn.
- **Escalation surfacing:** a PR parked `review:human` is surfaced in the main session with an offer to run /review.
- **Idle-wait stop:** announce and stop when the state-read's idle-clock inputs cross the configured window (queue empty + no user feedback).
- **Final ledger** at stop: what landed, what parked, what's still queued.

## Blocked on the deterministic core

`blockedBy` the two scripts (#2609, #2611): the skill must never re-derive a dispatch plan or a state read in prose — it shells the same scripts the future product conveyor will.
