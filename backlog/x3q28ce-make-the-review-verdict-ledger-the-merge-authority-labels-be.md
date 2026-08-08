---
kind: story
size: 5
status: open
parent: "2405"
dateOpened: "2026-08-08"
relatedTo: ["2841", "2416", "2750", "2820", "2745", "2979", "2830", "xzrs9xf"]
scope: ["we:scripts/lib/verdict-ledger.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/lib/pr-merge-gate.mjs", "we:scripts/review-set-label.mjs", "we:scripts/__tests__/verdict-ledger.test.mjs"]
tags: [review-integrity, drain, gate, governance, prevention]
---

# Make the review-verdict ledger the merge authority — labels become display only

Record every review verdict in an append-only ledger keyed by PR + the content it covered, and make the
drain merge only what the ledger clears. GitHub labels stay for humans to read but stop being the decision.
This closes the whole "hold that didn't hold" class (#2750, #2820, #2745, #2416) as one mechanism instead
of a patch per leaked path, and it is the durable review-seam record the enforce flip already names as its
missing precondition.

## Why labels cannot be fixed path-by-path

Every confirmed gate failure is the same bug wearing a new path: a mutable label carried the decision, and
some code that swaps labels erased it. PR #870 and PR #956 merged carrying `review:changes`; an operator's
`review:human` escalation evaporated in a label swap (#2745). #2841 already names the meta-problem —
"discover every decision-gate site instead of remembering them." As long as any label-writing code can
erase a verdict, new holes keep appearing. The fix is to move the truth somewhere append-only.

## What the ledger is

- An **append-only JSONL file** next to the drain's existing history (e.g.
  [we:scripts/lib/verdict-ledger.mjs](scripts/lib/verdict-ledger.mjs) owning the format). No database —
  the drain lease already guarantees a single writer, and a file is unit-testable gate-self code. If the
  planned conveyor state store lands later (#2626/#2742), the ledger migrates in as one table; the
  versioned schema makes that a one-off import.
- Each record carries a **versioned schema**: PR number, the diff content-hash the verdict covered
  (content-pinned per #2979, so a mechanical rebase does not void it), verdict, reviewer identity
  (human / named agent pass), timestamp, and reason.
- **Records are only appended, never edited.** A newer verdict supersedes an older one for the same PR +
  content-hash; a hold is cleared by a later clearing record, never by deleting anything.

## What changes at the seams

- The drain's merge gate ([we:scripts/lib/pr-merge-gate.mjs](scripts/lib/pr-merge-gate.mjs), consumed by
  [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs)) answers "may this merge?" from the ledger:
  latest verdict for this PR at this content-hash must be a clear, and no unanswered hold may exist.
- [we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) writes the ledger record first, then
  mirrors it to the label. A label that disagrees with the ledger is a display bug, not a gate bug.
- The shadow reviewer's would-clear decisions append to the same ledger — giving the enforce flip the
  durable shadow-vs-human agreement history it requires (today that seam "only logs to stderr").

## Rollout — shadow first

Phase 1: write the ledger alongside labels; the drain still reads labels; a checker reports any
ledger/label disagreement. Phase 2 (after ~a week of agreement): the drain reads only the ledger.
