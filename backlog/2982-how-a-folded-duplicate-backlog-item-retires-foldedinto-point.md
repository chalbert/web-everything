---
bornAs: xm3vnk8
kind: decision
status: open
dateOpened: "2026-08-06"
tags: [backlog, schema, burndown]
---

# How a folded-duplicate backlog item retires — foldedInto pointer vs cross-ref only

When `/consolidate` (#2983) finds two open items whose scope is genuinely the same job, the backlog has
**no honest way to retire the absorbed one**. This decides whether to add a retirement state for it, or to
rule that a near-duplicate simply stays open and cross-referenced.

## Why there is nothing to reach for today

- **`resolve` is the only close, and it means *delivered*.** A resolved item's `batchCost` feeds the
  burndown and the batch calibration `--points` figure (*[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md)
  → Calibrating the budget*). Resolving a never-built duplicate books points nobody earned and skews every
  future batch budget — so this branch is **broken on merit**, not merely unattractive.
- **A park can't carry it.** `parkedReason: superseded` was deliberately retired in the 2026-06-22 sweep
  ([we:src/_data/backlogMeta.js](src/_data/backlogMeta.js) → `parkedReasonMeta`): a park must reduce to a
  real structural gate (`blockedBy`, `humanGate`, `platform-gated`, `maturityGated`), and "another item
  already covers this" is none of those. `check:standards` errors on a parked item with no such reason.
- **`supersededBy` exists, but not for backlog items.** It is a research-topic / standards-home pointer
  ([we:scripts/check-standards.mjs](scripts/check-standards.mjs), the `RESEARCH_STATUSES` and retirement
  field-set blocks) — its pointer space is topic ids, not backlog ids.
- **The standing rule points the other way.** *Review before adding (dedup)* says to **cross-reference**
  parallel tracks rather than merge them.

## Fork 1 — does a folded duplicate get a retirement state?

**Option A — add a `foldedInto` pointer and a non-delivered close.** The absorbed item takes
`foldedInto: <id>` and leaves the open set without counting as delivered: it disappears from readiness
selection, renders a muted "folded into #NNN" pill (the pattern `unsplittableReason` / `childlessReason`
already establish in [we:src/_data/backlogMeta.js](src/_data/backlogMeta.js)), and `check:standards`
validates that the target resolves and that a folded item leaves no children or inbound `blockedBy`
dangling. The burndown ignores it entirely — scope removed, not scope completed.

*On merit:* the board states the truth — one job, one live card. A reader following the old `#NNN` URL lands
on a pointer to the survivor instead of a stale open card that will never be worked. The `NNN` stays
immutable and nothing is deleted, so the audit trail is intact.

**Option B — cross-ref only; both items stay open.** `/consolidate` records the overlap as a `crossRef`
on each side and, where one really does gate the other, a `blockedBy` edge. Whoever claims the survivor
resolves the sibling in the same pass as delivered work.

*On merit:* `resolved` keeps exactly one meaning — delivered — so the burndown needs no second notion of
"left the backlog". And a near-duplicate that turns out to differ in a detail is still independently
claimable, which a folded card is not; folding is a judgment call about sameness, and this branch never
has to be right about it.

**Recommended default: A**, conditional on the fold rubric being strict about *same job* (scope contained,
not merely adjacent). B is the honest fallback if the rubric can't be made strict enough — an over-eager
fold silently removes work, which is worse than a duplicate card.

## Prep still owed

Not prepared — no `preparedDate`. Prep must: check the statute layer for an existing anchor on backlog
retirement (*[we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md)* overlap check), settle
whether `foldedInto` is a new frontmatter field or a `status` value, name the exact loader + gate changes,
and red-team A (what does an over-eager fold cost, and can the rubric prevent it).

Until this resolves, `/consolidate` **reports** fold candidates and mutates nothing.
