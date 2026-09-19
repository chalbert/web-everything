---
name: minimize-blocking-permission-requests
description: Standing operational instruction — scope subagent work to avoid host-level/destructive permission prompts by default when dispatching for autonomous/overnight operation.
metadata:
  type: feedback
---

When dispatching subagents for autonomous/overnight work, be disciplined about which actions
require host-level or destructive permissions (writes outside a scratchpad/lane clone, actions
touching paths outside the project, etc.) — these block the requesting agent (and anything
waiting on it) until a human is present to approve, which defeats the point of autonomous
operation when the operator is away or asleep.

**Why:** surfaced 2026-09-14 during epic #3383's overnight session. A container-escape security
test legitimately needed host-filesystem write permission to prove its point (writing outside a
container's mount to `/outside-via-hook.txt` and the operator's home directory) — correctly gated
and correctly approved once seen. But the operator flagged the broader operational cost: these
prompts block progress entirely while unattended, and asked to minimize how often they're
triggered, rather than just accepting them as unavoidable overhead.

**How to apply:**
- Before dispatching a subagent, consider whether its task can be scoped to stay within the
  scratchpad directory, a lane clone, or other already-low-friction paths — prefer that scoping
  by default.
- Reserve genuinely host-level or destructive actions (writes to arbitrary host paths, killing
  processes, modifying shared/global config) for cases that actually need them to prove or
  accomplish something real — same bar as the container-escape test, not a lower one.
- When such an action is genuinely unavoidable, have the agent front-load a clear explanation of
  why, so whoever reviews the prompt (possibly hours later) can approve quickly without needing
  to reconstruct context.
- Do not push for broadening the operator's own permission settings to avoid this friction —
  that's the operator's trust boundary to set, not something to lobby for. It's fine to describe
  what a scoped allow-rule could look like (e.g. path-prefix-scoped auto-allow for the scratchpad
  directory) if asked, but the decision and the edit belong to the operator.
- This is a balance, not a mandate to avoid all such actions — a real security test or genuinely
  necessary host action is still worth doing and worth a permission prompt; the goal is not
  triggering them needlessly, not eliminating them entirely.
