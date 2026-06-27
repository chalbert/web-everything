---
name: feedback_analysis_verdict_is_item_state
description: "a could-not/won't-do triage verdict must be recorded as durable STATE on the subject item (a frontmatter flag that clears its deterministic badge), not left only in a dated report"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0e76a343-1b06-4a19-ade9-df9761057c2d
---

When an analysis/triage skill rules a candidate **could-not / won't-do** (e.g. `/split` → not-splittable),
the verdict must land as **durable state on the subject item**, not only in the dated `reports/<date>-…md`
artifact. A report is invisible to the next *deterministic* sweep, so a report-only verdict gets the item
re-flagged every run.

**Why:** the board derives badges deterministically from frontmatter (an oversized story carries a "split"
badge purely from `size`). Only a frontmatter flag *on the item* clears it; the dated report a future
session never opens cannot. Report-only = "analyzed" to me, "still a to-do" to the board.

**How to apply:** on a could-not-split, set `unsplittableReason` (`atomic` · `foundational` · `fixture`;
never a buried fork → that's a `kind:decision` card the story `blockedBy`s) **+** `relatedReport:` pointer
(also wires the report past `check:standards`'s hidden-report gate) **+** a short body note carrying the
nuance (field = coarse badge, note = detail). Never dishonestly shrink `size` to dodge the badge.
Generalizes past `/split`: any analysis verdict (won't-fix, can't-batch, deferred) belongs as a
badge-clearing frontmatter flag on the artifact it judges. Mirror of an epic's `childlessReason`. This is a
state-representing edit → apply without asking ([[feedback_state_representing_edits_no_permission]]).
Codified in split-backlog-item SKILL step 5 + backlog-workflow.md → "Record the verdict … unsplittableReason".
