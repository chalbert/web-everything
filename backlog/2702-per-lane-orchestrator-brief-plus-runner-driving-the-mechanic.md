---
bornAs: xoh0xzj
kind: story
size: 5
parent: "2677"
status: open
blockedBy: ["2699"]
scope: ["we:skills-src/conveyor/"]
dateOpened: "2026-07-27"
tags: []
---

# Per-lane runner: a headless runner driving the mechanical tick core for one lane

The DELEGATE half of #2677(b): a **headless runner** (under `we:skills-src/conveyor/`) that drives the mechanized tick core for ONE lane — **singleton-locked, no per-lane LLM** — so orchestration moves off the single serial main session out to the lanes. Ratified boundary #2701 (Option A, codified at [we:docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent](/docs/agent/platform-decisions/#conveyor-orchestration-mechanics-not-per-lane-agent)) settles this as **pure deterministic mechanics + a headless runner, NOT a per-lane conducting agent**: the runner reads state and steps the #2699 tick-core state machine, spends no model context per tick, and escalates genuine novelty up to the main-session judgment layer rather than improvising a ruling.

Build conditions from #2701: (1) durable guard state surviving a runner restart — delivered in #2699; (2) a **singleton lock** on the runner so two runners never double-dispatch the same lane/item (mirrors the drain daemon's sole-writer discipline) — the one net-new build condition.

Still BLOCKED only on #2699 (the mechanical core the runner drives must exist first); the #2701 boundary is now ratified, so the framing is settled.
