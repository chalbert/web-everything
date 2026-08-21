---
kind: story
size: 3
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateResolved: "2026-08-21"
tags: []
---

# a juror returning no findings AND no summary reduces to accept, not unrun

`REVIEW_JUDGE_SHAPE` declares `required: ['findings']` — **`summary` is optional** — so a juror may return
exactly `{findings: []}`, having said nothing about what it looked at. `deriveVerdict` then reduces that to
`accept` and the run reports an accepted review to the operator.

Observed twice on PR #1513, two independent jurors, 13 turns and ~$0.79 each over the full 48.5k-char diff:
both returned `{findings: []}` with an empty summary. PR #1510's juror returned the same empty findings array
alongside a 548-character account of what it had verified, so the field CAN be populated — its absence is not
a property of a clean review.

**What already works, and must not be broken while fixing this.** `record-verdict` REFUSES such a run:
*"staged no write-up to carry. The durable comment IS the review; a verdict with an empty body lands a label
and tells the author nothing."* That refusal is correct and it is what caught this. So nothing false has been
recorded — but the pipeline DEADLOCKS instead: the review says `accept`, and the verdict can never be carried.

The fix belongs upstream of both. A juror that judged must say what it judged: make `summary` required in the
judge shape, so an empty one is refused at the step that produced it rather than three steps later, where the
operator has already been told the PR was accepted. Same class as #2949 and the three-valued outcomes
elsewhere — absence of evidence must never reduce to evidence of absence.

## Done when

1. **Executable** — a juror answer of `{findings: []}` with no `summary` is REFUSED by the judge step, and the
   suite pins that a populated summary with zero findings still reduces to `accept`.
2. **Observable** — `we:scripts/operations/review-pr.mjs`'s `REVIEW_JUDGE_SHAPE` lists `summary` in `required`.

