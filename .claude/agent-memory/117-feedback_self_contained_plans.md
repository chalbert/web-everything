---
name: feedback_self_contained_plans
description: Plans/handoff docs must be fully self-contained so a fresh session with no prior context can execute them
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b9e07701-b0aa-444b-9587-b06189a821a3
---

When writing a plan or handoff document, make it FULLY self-contained: a new session with zero prior context must be able to execute it. The user said "my goal is for a new session to start working on this so the plan needs all the context."

**Why:** Plans get handed to fresh sessions/agents that don't share the originating conversation; anything left implicit is lost.

**How to apply:**
- Include: orientation/pointers, what already exists (files + their state), the decisions made, actionable steps with file paths + acceptance criteria, commands, and gotchas.
- Lead a report with `# Title` + a `**Goal:**`/`**Point:**` line and surface it (a backlog pointer item) so it isn't hidden — see [[feedback_backlog_is_tracker]] and [[feedback_materialization_pattern_codified]].
- Prefer a table-based plan (concern → layer → status → action → priority) for coverage/work plans.
