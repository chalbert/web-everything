---
bornAs: x0thbnt
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-prep.mjs", "we:scripts/operations/__tests__/review-prep-io.test.mjs", "we:scripts/operations/__tests__/review-prep.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Make the notice sink read the record effect's result (or fold the notice into the record sink's return)… (from chalbert/web-everything#3778 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/review-prep.mjs:527` — Make the notice sink read the record effect's result (or fold the notice into the record sink's return) and add an end-to-end op test for the refused-write path asserting the notice text.
2. `we:scripts/operations/__tests__/review-prep-io.test.mjs:563` — Add a negative-path case alongside any new allow-list catch: an error outside the list must rethrow. A lint or review-lens rule such as 'every catch that filters on a tag needs a test for the unfiltered branch' would cover this class of defect.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3778@1f97d3c72440fd62517c270f630870bd26c0b94b

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
