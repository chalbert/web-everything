---
kind: story
size: 3
status: open
blockedBy: ["2281"]
dateOpened: "2026-07-10"
tags: []
---

# Generalize the CI-truth reconcile pass to a total ci-lifecycle label function

Implement the #2281 ruling: generalize reconcileGreenLabels (we:scripts/merge-ai-prs.mjs:702-718) from green-only to a total lifecycleLabelFromCiTruth over every open AI PR — checking / ci:failed / blocked / ready-to-merge, exactly one each, set by the existing reconcile sweep (every drain pass + --watch interval), never per-check-tick pr-land writes. Mint the new labels idempotently in the existing gh-label-create loop (we:scripts/merge-ai-prs.mjs:870-881). Replace the bare-exit at we:scripts/pr-land.mjs:603 (red) and the bare --no-wait open (:577-579) so no ci-lifecycle state is read from a label's absence. Preserve the ready-to-merge landing-gate absence-semantics (#2183 F1 / #2138 F4). Extend the transition-table tests (we:scripts/__tests__/pr-land.test.mjs, we:scripts/__tests__/merge-ai-prs.test.mjs) with the exactly-one-label invariant.
