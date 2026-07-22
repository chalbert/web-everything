---
bornAs: xxa7f8p
kind: story
size: 5
parent: "2612"
status: resolved
blockedBy: ["2609", "2611"]
dateOpened: "2026-07-22"
dateStarted: "2026-07-22"
dateResolved: "2026-07-22"
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

## Progress

- Built `we:skills-src/conveyor/SKILL.md` (the `/conveyor` skill, surfaced via the `we:.claude/skills` → `../skills-src` symlink) and `we:.claude/commands/conveyor.md` (the slash-command entry). Both are THIN — orchestration prose that shells the deterministic scripts; no scripted rule is re-derived in the skill body.
- The skill's arc, as ratified in epic #2612: start/configure (pool size · conflict policy default wait · idle-stop default 15 min; the chat stays conversational, operator queues via `we:scripts/backlog.mjs build-queue add <NNN>`) → chained-sleep tick loop (`we:scripts/readiness/conveyor-state.mjs --json` → `we:scripts/readiness/dispatch-plan.mjs --json` → one background delivery `Agent` per launch entry instantiating `we:skills-src/conveyor/delivery-agent-brief.md` → one `we:scripts/conveyor/pr-watch.mjs <pr>` per in-flight PR whose exit wakes the loop → one terse status line → `sleep 120` heartbeat) → watcher-exit branch (merged 0 · error 1 · parked 2 → surface `/review` · timeout 3 · closed 4 → anomaly) → landing is the resident drain daemon (the skill never merges) → state is the board's channels only (no parallel store) → idle-stop → final ledger.
- Cites [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](docs/agent/platform-decisions.md#deterministic-core-thin-judgment) throughout: every script-decidable decision is delegated; judgment (readiness, supervising a build, escalation review) stays with the operator/agents.
