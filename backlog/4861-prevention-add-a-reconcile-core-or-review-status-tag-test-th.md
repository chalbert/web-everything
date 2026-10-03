---
bornAs: xnbplbt
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/review-status-tag.mjs", "we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/__tests__/review-status-tag.test.mjs", "we:scripts/conveyor/__tests__/fix-procedure.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a reconcile-core or review-status-tag test that asserts what happens to the withdrawn label once is… (from chalbert/web-everything#3681 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/review-status-tag.mjs:167` — Add a reconcile-core or review-status-tag test that asserts what happens to the withdrawn label once `isDraft` flips to false. That documents the intended lifecycle for the hold.
2. `we:scripts/conveyor/fix-procedure.mjs:598` — Add a regression test that runs every explicit and automatic label writer (`fixBegin`, `fixEnd`, `tagReviewStatus`, `applyReviewStatus`) over a PR holding `draft-withdrawn` and asserts the planner still refuses. Alternatively, make `fixBegin` keep the withdrawal label unless the new reason is withdrawal.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3681@9e61d62d86bf8b926f968f1a7c4a38c826ad4ecd

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
