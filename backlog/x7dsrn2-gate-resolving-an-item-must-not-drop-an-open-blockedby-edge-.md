---
kind: task
status: open
dateOpened: "2026-08-02"
tags: [governance, check-standards, backlog-integrity]
---

# Gate: resolving an item must not drop an open blockedBy edge in the same diff

A `check:standards` rule (and a `PreToolUse(Edit|Write)` backlog deny for shift-left) that **errors** when a
single diff flips an item's `status:` to `resolved` AND removes a `blockedBy` entry in the same edit —
**UNLESS** the removed target is itself already `resolved`. Real prerequisites are recorded even after the
blocker resolves (per `we:docs/agent/backlog-workflow.md`), and the sanctioned
`we:scripts/backlog.mjs resolve` transition never touches `blockedBy`.

## Why (the #1002 defect this prevents)

On resolving #2840, the diff deleted `blockedBy: ["2785"]` while #2785 was still `status: open` — the item's
own anchor + body still cited "blockedBy #2785 … landing first", and the follow-on `xe5vt9s` re-declared the
same edge, so the file contradicted itself. Nothing caught it because the resolve was a hand edit, not the
sanctioned CLI transition. This gate makes the drop mechanically visible: dropping a live (open-target) edge at
resolve is an error the author must justify (the blocker really is gone) or reinstate.

## Scope

- Detect base-vs-head in a backlog item: `status:` changed to `resolved` AND a `blockedBy` array element
  removed.
- Error unless every removed target is `status: resolved` on the head tree.
- Wire into the whole-tree `check:standards` run and the `PreToolUse(Edit|Write)` backlog deny path (memory
  rule #43).

Prevention filed against #1002's blocking fix 2 (dropped `blockedBy` on resolve). Mechanical,
committee-clearable.
