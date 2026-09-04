---
name: act-as-if-a-ui-were-the-one-filing-changing-items
description: "For routine backlog filing/status-changing, prefer the declared operations layer over hand-authored edits — the destination is a UI (not an AI session) driving these same operations; hand-rolled fixes stay reserved for genuinely out-of-the-ordinary bugs."
metadata:
  type: feedback
---

**Filing or changing a backlog item should go through as mechanical an operation as possible —
AI judgment only where actually needed.** The operator's own framing (2026-09-03, verbatim):
"we need to act as if we were a UI and that all operations needed were happening from a user
request, not an AI session — because this is the destination." For genuinely out-of-the-ordinary
bugs, a hand-rolled fix is still fine — but the more routine cases (file an item, flip a status,
scaffold a follow-on, resolve on land) recover through a real, declared operation instead of an
agent editing frontmatter by hand, the closer this repo gets to a state where an actual UI surface
— not an AI session running shell commands — could trigger the same action.

**Why this sharpens (not replaces) the existing statute:** this repo already ratified
[`we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment`](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
— the operator's framing here is the same principle stated as a concrete test: **"would a UI
button be able to do this?"** If the honest answer is "no, only an agent hand-editing files could,"
that is itself the signal the routine part of the action should be a declared operation
(`we:scripts/operations/*.mjs`, reachable via `run.mjs <operation>`), not something that only
works because an AI session is holding the pen.

**How to apply:** when briefing a delegate (or acting directly) to file a new item, reopen one,
scaffold a follow-on, or resolve one — name the real declared operation to use
(`we:scripts/operations/scaffold.mjs`, `we:scripts/backlog.mjs resolve`/`claim`/`release`, etc.)
rather than "edit the frontmatter directly," even when the specific field being changed
(`status:`, `dateResolved:`) looks trivial enough to hand-edit. Reserve a genuinely hand-authored
fix for the actual out-of-the-ordinary case: a real code bug, a novel investigation, something no
existing operation covers yet — and when THAT happens repeatedly, that itself is the signal a new
operation is missing and should be added (mirrors [[no-hand-rolling-around-a-missing-operation]]).
