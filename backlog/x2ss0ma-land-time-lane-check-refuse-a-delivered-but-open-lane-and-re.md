---
kind: task
status: open
dateOpened: "2026-08-02"
tags: [review-integrity, check-standards, drain, backlog, gate]
scope: ["we:scripts/check-standards.mjs", "we:scripts/merge-ai-prs.mjs"]
---

# land-time lane check — refuse a delivered-but-open lane; require the reciprocal blockedBy

review-integrity guard for the xc7p3q9 S3/S4 delivered-but-open + prose-only-Blocks
class.

## Why

The xc7p3q9 item lands `status: open` with no `dateStarted`/`dateResolved` even
though its own PR delivers it — so `check:readiness --select` offered
already-delivered work for a fresh lane, and because its `scope` names the sole
writer to main, the dispatcher would hold every other merge-engine item behind
it. The sibling xq985wu landed the same way and needed a follow-up "verify …
already landed" commit. Separately, "Blocks #2832" was prose-only — no reciprocal
`blockedBy` on 2832 — so the conveyor could dispatch 2832's `ready-to-merge`
strip BEFORE this fix landed (the exact ordering the item declares unsafe). Both
fixed by hand this round; this item captures the guards.

## The guards

1. **Delivered-but-open** — a land-time lane check (in the drain / a
   `check:standards` lane rule) that REFUSES a lane whose manifest `item` is still
   `status: open` with no `dateStarted` while the lane diff touches a file inside
   that item's own `scope:`. A lane delivering an item must have claimed it
   (`dateStarted`) — an open, unclaimed item cannot also be shipping.
2. **Reciprocal blockedBy** — a rule that an outward `Blocks: #NNN` assertion in a
   backlog item requires the reciprocal `blockedBy: [<this-item>]` on the named
   item. A one-directional block is invisible to the ordering the conveyor reads.

## Acceptance

- Guard 1 fires on a lane touching its own-scope files while the item is
  `open`/no-`dateStarted`; passes when the item is claimed/resolved.
- Guard 2 fires on a `Blocks: #NNN` with no reciprocal `blockedBy` on `NNN`.
- 0 new errors on the `check:standards` gate for the current tree.
