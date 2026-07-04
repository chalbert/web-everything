---
name: decision-item-single-source-not-discussion-log
description: A decision/backlog item is one clean current source of truth — when discussion changes the call, REWRITE it to the new state, never layer it as a discussion log
metadata:
  node_type: memory
  type: feedback
  originSessionId: fd863846-e1b5-4a37-975f-ff725e333a21
---

When a live discussion changes a decision item's verdict (a fork flips, a default is reframed, a rung
folds in), **rewrite the item to a single coherent current statement** — do **not** accumulate the
change history *in the item*. The failure mode the user flagged hard ("this is very confusing — 1 source
of truth, remember; the story is not a discussion"): I patched #1985 by stacking a new "Ratification"
section on top, marking the old verdict ~~struck-through~~ / "SUPERSEDED" / "awaiting ratification", and
leaving a glance-table that said one thing while the body still said the opposite. That turns the item
into a changelog the next reader has to reconcile.

**Why:** the item *is* the contract; its job is to state what is true *now* so a fresh session (or the
decider) reads one answer, not a transcript to diff. Supersession banners, strikethroughs, top-vs-body
dueling verdicts, and "(reframed in discussion)" asides all leak the conversation into the artifact.
Distinct from [[closeout-never-infers-ownership-from-dirty-tree]] and the source-of-truth rules in
`docs/agent/backlog-workflow.md` (which say *what you voice* must match the item) — this is about *how you
author the item itself* as it evolves: one voice, current state.

**How to apply:** when discussion supersedes part of an item, **edit that part in place to the new
verdict** and delete the stale framing — keep only what is still true (e.g. a refutation that remains valid
becomes supporting reasoning, not a "this was rejected" banner). The red-team / skeptic lines are
legitimate (they're the decision's record, not discussion residue); a layered "Ratification vs Recommended
path vs awaiting" dueling structure is not. The discussion belongs in chat; the item carries only its
resolved current shape.
