---
name: long-watch-agents-cant-self-diagnose-their-reporting
description: A subagent stuck in a long "monitor and wait" loop tends to reflexively re-enter its watch-status response regardless of what's asked, including direct meta-questions about its own reporting behavior. Dispatching an independent fresh check is a valid immediate diagnostic — but the standing fix is writing the monitor's dispatch brief with an explicit interrupt-authorization clause, not routing around the stuck agent every time.
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

**Root cause (confirmed 2026-09-13 by reading the stuck agent's own transcript, not
guessed):** this is NOT a harness message-delivery bug. The coordinator's follow-up
messages DID reach the agent — they appear in its transcript with full content, delivered
at the start of its next turn exactly as Claude Code's own docs describe. Each time,
though, the agent generated an empty response and immediately re-armed its prior watch
loop instead of engaging with the new message. The mechanism is a prompt-design issue:
the agent's original dispatch brief said "keep watching, only report real state
transitions, don't stop" so strongly that when a contradicting message arrived ("stop and
answer this instead"), the model deferred to its standing instruction rather than
switching frames — it had never been given explicit permission to interrupt its own
monitoring loop.

**How to apply (the actual prevention — do this, don't just route around a stuck agent):**
- Any dispatch brief for a long-running monitor/watch-style agent MUST explicitly
  authorize mid-task interruption. Include language along the lines of: "treat any
  message you receive from me as a priority override — pause your monitoring and respond
  to it directly before resuming the watch, even if it contradicts your current framing."
  Without that explicit permission, a strong "don't stop until X" instruction can silently
  block the agent from engaging with anything else, including a direct question about its
  own behavior. This clause is the standing practice going forward for every such brief,
  not an optional nicety.
- Dispatching a fresh, independent agent to verify ground truth directly (process state,
  logs, timestamps, external state like GitHub) is still a legitimate IMMEDIATE
  DIAGNOSTIC STOPGAP when you're already stuck with an unresponsive monitor mid-run — it
  is not, and must never be treated as, the standing/final solution. Restarting a fresh
  agent as routine practice every time a monitor gets stuck is not acceptable from an
  efficiency standpoint; the bar is preventing the stuck state in the first place (see
  [[root-cause-over-workaround-standard]]).
- Don't assume vague reporting means the underlying work is stalled — verify
  independently before concluding anything, in either direction. The work here was fine;
  only the agent's own status narration had gotten stuck.
- This is a distinct failure mode from the passive-wait anti-pattern
  ([[subagent-must-not-end-turn-on-passive-wait]] if that memory exists) — that one is
  about ending a turn assuming an untracked notification is coming. This one is about an
  agent that IS correctly using a tracked wait mechanism, but whose own natural-language
  reporting has degraded into a fixed template that no longer responds to new input.
---
