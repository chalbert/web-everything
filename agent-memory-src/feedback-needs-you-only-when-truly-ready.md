---
name: feedback-needs-you-only-when-truly-ready
description: In status/wip reports, only flag "Needs you" when the operator's action is the sole remaining blocker right now — not pre-emptively while something else (a review, a dependency) is still in flight.
metadata:
  type: feedback
---

Don't list an item under a "Needs you" / blocked-on-operator section just because it will
eventually need the operator's input — only list it once every other prerequisite has
actually finished and their decision/review truly is the only thing left.

**Why:** caught live during an overnight session (webeverything repo, 2026-09-07) — a `/wip`
report listed two PRs under "⚠ Needs you" while explicitly noting they were "waiting on
independent review to complete first." That's self-contradictory: if something else is still
blocking it, the operator can't act on it yet either, so it isn't really "needs you" — it's
still "doing." The user corrected this directly: "Ok should bot tell me need me unless
really ready."

**How to apply:** before putting a row under "Needs you" (in `/wip`, `/status`, or any
ad hoc status update), ask "if the operator looked at this right this second, could they
actually act on it?" If the honest answer involves "once X finishes" or "after Y lands,"
it belongs in "Doing" instead, however soon it's expected to flip. Fixed directly in the
user's own `/wip` command definition (`~/.claude/commands/wip.md`) so this is now a written
rule, not just a one-off correction to remember.
