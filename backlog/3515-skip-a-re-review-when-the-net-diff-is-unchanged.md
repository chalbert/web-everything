---
bornAs: x6z6z2j
kind: story
size: 3
status: open
scope: ["we:scripts/operations/review-dispatch.mjs"]
dateOpened: "2026-09-06"
tags: [cost, review, conveyor, operations, dispatch]
relatedReport: reports/2026-09-06-backlog-split-analysis.md
---

# Skip a re-review when the net diff is unchanged

The cheapest review is the one not run. #3006 recorded several PRs being **fully re-reviewed after a push that
touched only a backlog card** — the reviewed-diff fingerprint that would have caught it already exists, but it
gates the *merge*, not the *review dispatch*.

## The gap, precisely

The machinery is real and already consumed: `parseReviewedDiff` and `acceptanceCoversHead` in
[`we:scripts/lib/review-escalation.mjs`](../scripts/lib/review-escalation.mjs), read by
[`we:scripts/merge-ai-prs.mjs`](../scripts/merge-ai-prs.mjs) around line 4001 to decide whether an acceptance
still covers the head. Nothing consults it *before spawning a reviewer*.

So the wasted work is a whole review invocation — the most expensive agent call in the loop — repeated against
a net diff that a fingerprint comparison would have shown was identical.

## Scope note, learned the hard way

The 2026-09-06 split analysis first scoped this to `we:scripts/operator/dispatch.mjs`, which has **zero
production importers** and is the surface #3383 is replacing — a skip installed there could never have fired.
The live review-dispatch surface is [`we:scripts/operations/review-dispatch.mjs`](../scripts/operations/review-dispatch.mjs),
wired through `we:scripts/operations/completion-cli.mjs` and the `we:scripts/conveyor/reconcile-*.mjs` pass. No
open item currently claims it in a `scope:`, so this does not double-book.

Adjacent but **not** the same deliverable: **#2979** (`active`) makes an accept survive a mechanical rebase by
proving content equivalence rather than SHA identity. That is about not *re-parking* an existing accept; this
is about not *dispatching* a fresh review. They share the fingerprint concept and should stay consistent —
coordinate rather than duplicate.

## Done when

1. **Executable** — a re-review dispatched against a head whose net diff fingerprint matches the last reviewed
   one is skipped, with the skip recorded; a head whose diff genuinely changed still dispatches. A test asserts
   both directions.
2. The skip is *loud* — it records why it skipped, so a silent no-review is never mistaken for a passing review.
