---
kind: story
size: 5
parent: "xkggoo0"
status: open
blockedBy: ["x53zzf9", "xe2fmix"]
dateOpened: "2026-07-22"
tags: [conveyor, skill]
---

# The /conveyor skill + command

The thin skill markdown + `we:.claude/commands` entry that operates the conveyor (#xkggoo0) from the main session. Thin by design: every decision with a right answer is delegated to the scripts it shells — the dispatch-plan script (#x53zzf9) and the tick state-read script (#xe2fmix), which block this item — per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](docs/agent/platform-decisions.md#deterministic-core-thin-judgment). The skill keeps only the judgment and the conversation.

## What the skill does

- **Conversational arc:** start → confirm pool size + policies with the user → run.
- **Tick loop:** state-read script → dispatch-plan script → spawn one background delivery agent per launch entry (#x32ajky brief) → **one-line status per tick** (per the progress-tracking preference: the checklist is the progress channel, prose stays quiet).
- **Watcher spawning:** one merge watcher per in-flight PR (#x32ajky) so a merge/park wakes the session instantly and the freed lane is re-dispatched the same turn.
- **Escalation surfacing:** a PR parked `review:human` is surfaced in the main session with an offer to run /review.
- **Idle-wait stop:** announce and stop when the state-read's idle-clock inputs cross the configured window (queue empty + no user feedback).
- **Final ledger** at stop: what landed, what parked, what's still queued.

## Blocked on the deterministic core

`blockedBy` the two scripts (#x53zzf9, #xe2fmix): the skill must never re-derive a dispatch plan or a state read in prose — it shells the same scripts the future product conveyor will.
