---
name: night-mode-quiet-orchestration
description: From 10 PM ET (or when the operator says they're off for the night) until they ping back — quiet orchestration, no per-merge turns; emergency stops always noted
metadata:
  type: feedback
---

**Night mode runs from 10 PM ET, or earlier as soon as the operator says they're off for the night, until the operator pings back.** Work keeps going (builder, daemons, standalone Codex/agy jobs), but the orchestrator stays quiet:

- Keep only the watches that can need action: a worker or job finished or failed, a new health problem, or a stop condition. Drop the per-merge watch and any "merged, no action" message.
- Check in once every 30 minutes (overnight-check → refill standalone Codex/agy jobs → re-arm watches). Each check-in is one short line, or nothing when nothing changed.
- Codex/agy work runs as detached background jobs, never inside a turn.
- **An emergency stop is always noted.** If health really deteriorates or ≥3 PRs wait on review:human, stop the work (my jobs + the builder kill switch), write the reason and time into the plan, and send a push notification. Never stop silently.
- In the morning, on the operator's first message: one summary of the night.

**Why:** operator, 2026-09-30 morning. The first overnight run (29→30 Sep) spent roughly 150 turns, each re-reading the long conversation, mostly on "#30xx merged, no action". Staying quiet saves most of those tokens and changes nothing about the work, since the builder and the daemons don't depend on the orchestrator's turns.

**How to apply:** at 10 PM ET, or on "I'm off for the night", switch to night mode and say so in one line. Leave it on the operator's next message.
