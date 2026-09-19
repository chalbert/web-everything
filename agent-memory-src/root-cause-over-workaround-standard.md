---
name: root-cause-over-workaround-standard
description: When something breaks or misbehaves (agent communication failures, tooling gaps, recurring errors), the standing bar is root-cause understanding and prevention — a workaround is only ever an immediate stopgap, never the accepted final solution, even when it's efficient in the moment.
metadata:
  type: feedback
---

The default response to a discovered problem must be to understand and fix why it
happened, not just to route around the symptom — even when routing around it is fast
and the underlying work turns out to be fine. Efficiency of a single workaround is not
the same as efficiency of the overall system; recurring problems "handled" by a
standing workaround compound in cost and erode reliability, even if each individual
instance looks cheap.

**Why:** stated directly by the user after a monitor-style subagent got stuck giving
vague status reports instead of answering direct questions. The practical fix in the
moment — dispatch a fresh independent agent to check ground truth — worked and confirmed
the underlying work was healthy. But the user explicitly rejected treating that as the
standing solution: "not acceptable from efficiency point of view to restart new agent as
the standard solution. We want to strive for 100% correct runs." See
[[long-watch-agents-cant-self-diagnose-their-reporting]] for the specific incident this
was drawn from.

**Confirmed example of doing this right:** for the incident above, root-cause
investigation (2026-09-13) read the stuck agent's own transcript rather than guessing.
It found the messages were delivered correctly (no harness bug) — the agent simply had
no explicit permission to interrupt its own "keep watching, don't stop" framing, so it
deferred to that standing instruction instead of engaging with the new message. The
prevention that follows from this is concrete and mechanical: every dispatch brief for a
long-running monitor/watch-style agent must include an explicit interrupt-authorization
clause (e.g. "treat any message you receive from me as a priority override — pause your
monitoring and respond to it directly, even if it contradicts your current framing").
That is the fix; "dispatch a fresh agent to check" remains a valid one-time diagnostic
when you're already stuck mid-run, but it is not the prevention and should not be relied
on as routine practice.

**How to apply:**
- Treat a workaround as legitimate ONLY as an immediate, explicitly-labeled stopgap while
  root-cause investigation continues in parallel — never silently let the workaround
  become the permanent answer by default.
- When reporting a workaround back to the user, say plainly that it's a stopgap and that
  root-cause work is either planned or in progress — don't present it as if the problem
  is solved.
- Once root cause is confirmed, update the standing practice (a brief template, a hook, a
  check) so the failure mode is prevented, not just diagnosed faster next time.
- The target bar for this system is 100% correct runs, not "good enough with occasional
  manual recovery." A recurring failure mode that gets silently tolerated because a
  workaround exists is not meeting that bar.
- This applies beyond agent-communication issues — the same standard applies to tooling
  gaps, recurring bugs, and any other systemic problem: fix why it happens, don't just
  build a detector/recovery path around it and call it done.
