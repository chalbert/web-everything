---
bornAs: xbo61we
kind: task
status: open
dateOpened: "2026-08-19"
tags: []
---

# the synthesis truncation notice can misreport a doubly-capped report's original length

Found by the review-pr correctness juror on PR #1457 at head 941360b6: CONFIRMED, worseThanBase true, but cosmetic and parallelizable, so a carve-out rather than a bounce. When a committee panelist's report exceeds BOTH the run-record cap and the judge-excerpt cap in `we:scripts/operations/explore-io.mjs`, the truncation notice handed to the synthesis judge states an original length that is not the report's actual original length — it reports the already-capped size. A reader of the synthesis (or the juror itself) is told the panelist wrote less than it did, which understates how much was dropped at exactly the moment the most was dropped.

## Why it is worth fixing despite being cosmetic

The notice exists so the synthesis judge knows evidence was withheld. A wrong number does not merely misinform —
it misinforms in the reassuring direction, understating the loss precisely in the case where the loss is
largest. A juror reading "truncated from 40KB" when the panelist wrote 400KB has been told the excerpt is
representative when it is a tenth of the material.

Carved out on PR #1457 rather than fixed in place, deliberately: that lane had already been re-parked twice by
head movement and had hit the #2071 id race twice. Another push to correct a message string would have
restarted the churn for no correctness gain.

## Done when

1. **Executable** — a test with a report exceeding BOTH caps, asserting the notice reports the report's true
   original length rather than the intermediate capped one. It fails today.
2. A report exceeding only ONE cap still reports correctly — the fix must not trade one wrong number for
   another.
3. The single-cap and no-cap paths are unchanged, pinned by the existing assertions.
