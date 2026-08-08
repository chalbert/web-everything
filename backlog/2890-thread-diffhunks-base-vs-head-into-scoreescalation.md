---
bornAs: xpa89kw
kind: task
status: resolved
dateOpened: "2026-08-02"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
tags: [governance, mechanization, review-escalation, diff-plumbing, precondition]
---

# Thread `diffHunks` (base-vs-head content) into `scoreEscalation` and the write path

Shared producer-side precondition for the #2839 and #2840 enforcement gates: thread a base-vs-head
diff-content signal (`diffHunks`) into `we:scripts/lib/review-escalation.mjs#scoreEscalation` /
`producerReviewLabel` and both call sites, so the content-reading principle-surface detectors can see hunk
text instead of only file names. Filed once (not duplicated per gate) because both follow-ons depend on it.

## Why this is its own item

`scoreEscalation` is declared today over `{ changedFiles, diffLines, humanBasisFiles, dismissedFindings,
crossRepo, thresholds }` — file **names** and a line **count**, never hunk content — and both call sites
(`we:scripts/pr-land.mjs`, `we:scripts/merge-ai-prs.mjs`) pass exactly that. Both #2839's
`assertNotPrincipleAndImpl(changedFiles, diffHunks)` and #2840's `isPrincipleSurface(changedFile,
diffHunks)` read hunk content (statute-anchor-body edits and pre-existing-marker edits are base-vs-head
facts). Until this plumbing lands, those detectors evaluate against undefined content and under-fire on
exactly the class they exist for. This is new plumbing, not a no-op signature change.

## Scope

- Extend `scoreEscalation` / `producerReviewLabel` (`we:scripts/lib/review-escalation.mjs`) to accept a
  `diffHunks` (or base-vs-head content) input.
- Thread the signal from both call sites: `we:scripts/pr-land.mjs`, `we:scripts/merge-ai-prs.mjs`.
- Thread the same base-vs-head signal into the `PreToolUse(Edit|Write)` write path so the shift-left gate
  and the whole-tree run read the same content (memory rule #43).

## Preconditions / relationships

Precondition of #2839's gate (the `assertNotPrincipleAndImpl` item) and #2840's gate (the
`isPrincipleSurface` item). Enforces no principle itself — pure plumbing, committee-clearable under the
two-PR rule (`we:docs/agent/platform-decisions.md#principle-and-impl-two-pr`).
