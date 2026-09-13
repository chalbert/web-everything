---
name: long-watch-agents-cant-self-diagnose-their-reporting
description: A subagent stuck in a long "monitor and wait" loop tends to reflexively re-enter its watch-status response regardless of what's asked, including direct meta-questions about its own reporting behavior — don't keep interrogating it, dispatch an independent fresh check instead.
metadata:
  type: feedback
---

When a long-running background subagent (one dispatched to supervise/monitor another
process — a driver run, a build, anything with a wait loop) starts giving repeated vague
status updates ("still waiting", "standing by") instead of the concrete evidence asked
for, asking it directly — even a pointed follow-up demanding specifics, even a
meta-question asking it to explain WHY it keeps replying vaguely — usually does not
work. It tends to just re-enter the same watch-loop response pattern regardless of the
actual content of the follow-up message.

**Why:** observed directly in this session (epic #3383) — a driver-backlog-monitoring
agent was asked three times in a row for concrete evidence (timestamps, process checks),
replied with a vague status each time, then even a direct question asking it to explain
its own behavior ("were you not reading the message, defaulting to a template, etc.")
still produced another generic watch-status reply. A fully independent, freshly
dispatched agent was then asked to check the same thing from scratch (no coordination
with the stuck agent) and found the underlying work was actually fine the whole time —
the process was alive and had genuinely landed real PRs; only the REPORTING was broken,
not the work itself.

**How to apply:**
- If a monitoring/watch-style agent gives 2-3 vague reports in a row despite explicit
  requests for specifics, stop trying to get it to self-correct. Dispatch a fresh,
  independent agent to verify ground truth directly (check the actual process, logs,
  timestamps, external state like GitHub) rather than continuing to interrogate the
  stuck agent.
- Don't assume vague reporting means the underlying work is stalled — verify
  independently before concluding anything, in either direction. The work here was fine;
  only the agent's own status narration had gotten stuck.
- This is a distinct failure mode from the passive-wait anti-pattern
  ([[subagent-must-not-end-turn-on-passive-wait]] if that memory exists) — that one is
  about ending a turn assuming an untracked notification is coming. This one is about an
  agent that IS correctly using a tracked wait mechanism, but whose own natural-language
  reporting has degraded into a fixed template that no longer responds to new input.
---
