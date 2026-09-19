---
name: dispatched-subagent-orchestrates-multi-part-tasks
description: A dispatched subagent handling a multi-part task should itself split, route, and parallelize across Gemini/Codex/Claude by fit, not just execute serially
metadata:
  type: feedback
---

Splitting work across Codex/Gemini/Claude and verifying each piece isn't a top-level-session-only
habit. Any Claude subagent — dispatched by the main session, the conveyor, or another subagent — that
receives a task with multiple distinct parts should act as a small orchestrator itself, not just an
executor that works the parts one at a time in its own context.

When a dispatched task has multiple parts, do this before diving in:

1. **Split where genuinely separable.** Break the task into distinct, well-scoped sub-pieces only where
   the work is actually independent. Don't force an artificial split on inherently sequential or
   interdependent work just to look parallel — a fake split costs coordination overhead for nothing.
2. **Route each sub-piece by fit, honestly.** For each piece, judge whether it matches Gemini's proven
   profile (well-specified execution: a clear target, known success criteria, a mechanical
   transformation — NOT open-ended design or judgment work), Codex (judgment-heavier build work), or
   should stay with Claude directly (verification, synthesis, real judgment calls). Don't default
   everything to Claude just because Claude is doing the routing.
3. **Dispatch independent pieces in parallel, not sequentially**, whenever they don't share file scope
   and have no real ordering dependency. This both speeds up the task and spreads load across the
   Gemini/Codex/Claude quota pools instead of concentrating everything on whichever one the subagent
   defaults to.
4. **Apply the same real-verification discipline to every piece regardless of who did it** — real diff
   review, real test runs, genuine independent review before landing. Parallelizing execution is a
   speed and load-balancing move, never a license to skip verification on any single piece.

**Why:** the operator has run this pattern all session at the top level (splitting work across
Codex/Gemini/Claude by fit, verifying each before landing) and wants it as the standing default
behavior for every dispatched subagent handling multi-part work, not something only the main
orchestrating session does. A subagent that just executes a multi-part task serially in its own
context wastes the same parallelization and quota-spreading the top level already relies on, and a
subagent that routes everything to itself out of convenience skips the fit judgment that makes the
top-level pattern work in the first place.
