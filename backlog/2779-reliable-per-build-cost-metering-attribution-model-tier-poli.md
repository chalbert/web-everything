---
bornAs: xyo1vaf
kind: story
size: 8
priority: low
parent: "2531"
status: resolved
unresolvedReason: "#2779-incident: PR #2785 (branch lane/2779-session-token-fresh) merged and the drain's resolve-on-land bookkeeping wrongly flipped this unrelated card to resolved off a branch-name coincidence (the branch's leading digits matched an unrelated open PR number, not this card) - nothing for this card was built. See we:scripts/lib/open-pr-items.mjs (deliveredItemNumsFromPr openPrNums guard) and we:scripts/lib/commit-message-safety.mjs for the product fix."
dateUnresolved: "2026-09-26"
scope: ["plateau:src/build-runner/"]
dateOpened: "2026-07-28"
dateResolved: "2026-09-27"
tags: []
---

# Reliable per-build cost metering, attribution, model-tier policy and audit log

The foundation slice of the SaaS cost-governance epic: replace the unreliable, non-persisted costUsd counter (plateau:src/build-runner/events.ts, discarded at plateau:src/build-runner/build-action.ts) with a durable per-build cost record attributed to tenant + item + run. Folds model-tier cost policy (per-plan model + ceiling, wired to the runner --model hook / plateau:src/build-runner/profiles.ts) and the durable queryable audit/billing log, both of which read metering. Blocks the per-tenant budget-gate slice.
