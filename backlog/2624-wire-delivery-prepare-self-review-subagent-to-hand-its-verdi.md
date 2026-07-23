---
bornAs: xnyz8ch
kind: story
size: 2
parent: "2612"
status: open
dateOpened: "2026-07-23"
tags: [plateau-loop, conveyor, agent, review]
---

# Wire delivery/prepare self-review subagent to hand its verdict back by return value, not agent name

In the dry-run, the delivery agent's **step-6 self-review subagent** tried to hand its verdict back to the parent with a name-addressed `SendMessage` and **failed** ("no agent named … reachable" — the parent had already moved on). The verdict still reached the parent out-of-band (it reported convergence), so this may be benign — but a review verdict that can only arrive by name-addressing a parent that may have moved on is a **fragile hand-back**: a converged/failed verdict could be silently lost.

**What happened.** The self-review subagent is spawned by the delivery agent to check its own work (step 6 of the delivery brief). When it finished, it addressed its verdict to the parent by name via `SendMessage`. By then the parent had progressed past the point where it was reachable by that name, so the send errored. The parent got the result anyway — hence "may be benign" — but only because it happened to observe convergence through another channel.

**The fix.** Make the self-review → parent hand-back a **return value**, not a name-addressed message: the subagent's final report is its verdict, and the parent reads that return value directly (the harness always delivers a spawned agent's final report to its spawner). A return value can't miss — there is no "is the parent still reachable by this name" race. Firm up the delivery brief's step-6 wording ([`we:skills-src/conveyor/delivery-agent-brief.md`](../skills-src/conveyor/delivery-agent-brief.md)) so the verdict rides the return path.

**First: confirm benign vs. real gap.** Reproduce or reason through whether the out-of-band arrival was luck (a real loss risk) or guaranteed by the harness. If it's a real gap, the return-value wiring above is the fix; if it's structurally safe, downgrade this to a brief-wording clarification. Either way the step-6 hand-back should be stated so a verdict can't depend on the parent's name still resolving.

Refs the conveyor delivery brief ([#2613](/backlog/2613-the-conveyor-skill-command/)).
