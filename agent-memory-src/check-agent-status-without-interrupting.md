---
name: check-agent-status-without-interrupting
description: Standing operational instruction — prefer a non-interrupting status check (TaskOutput block:false) over SendMessage when the goal is only to check a running subagent's progress.
metadata:
  type: feedback
---

When checking a running subagent's progress, prefer a non-interrupting status check over
`SendMessage` where possible — `SendMessage` forces the agent to stop its current work and compose
a reply, which costs real time/tokens and can slow down genuinely healthy in-progress work.

**Why:** surfaced 2026-09-14 during epic #3383's overnight session. The operator asked whether
progress could be checked "without asking the agent, it risks slowing it down." The `TaskOutput`
tool (deferred, load via ToolSearch), called with `block: false` and a short `timeout`, returns the
agent's current live transcript tail without requiring it to stop and respond — confirmed working
in practice: it surfaced real evidence of decision-making already in progress (an agent's own
judgment call to file a decision instead of building it live) without interrupting that agent's
actual work.

**How to apply:**
- For a `local_agent`-type task, prefer `TaskOutput({task_id, block: false, timeout: <short>})` over
  `SendMessage` when the goal is purely "what's it doing right now" — it returns a truncated tail
  of the live transcript, which is often enough to judge real progress vs. a stall.
- `TaskOutput`'s own tool description marks it deprecated and warns not to read a `local_agent`
  task's `.output` file directly via the Read tool (it's the full JSONL transcript and will
  overflow context) — `TaskOutput` itself handles the truncation safely; a direct file read does
  not.
- Reserve `SendMessage` for when you actually need the agent to act on new information, change
  course, or answer a question it can't infer from its own transcript alone — not as the default
  way to check on it.
- This doesn't replace `ListAgents` (which tells you whether something is running and for how
  long) — use `ListAgents` first to see what's alive, then `TaskOutput(block:false)` on a specific
  one if you need to judge its real progress before deciding whether to interrupt it.
