---
kind: story
size: 8
parent: "3383"
status: open
scope: ["we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/build-dispatch-policy.mjs", "we:scripts/lane-stack.mjs", "we:scripts/readiness/overlap-chain.mjs", "we:scripts/operations/review-pr-io.mjs", "we:config/platformDefaults.ts", "we:config/defineConfig.ts"]
dateOpened: "2026-10-03"
tags: []
---

# Configurable overlap strategy for PR repairs: stack on the predecessor instead of waiting in line

Operator ruling 2026-10-03: overlapping PRs get a configurable strategy. Today we:scripts/conveyor/reconcile-fix-dispatch.mjs serializes PRs whose files overlap (live: #3767 waited '2nd behind #3787' on we:scripts/__tests__/review-set-label.test.mjs for hours). New setting dispatchGate.overlapStrategy with values queue (today) and stack; stackMaxDepth default 2; stackReview default incremental (review the PR's diff on top of its predecessor's head) with a full-diff check before merge. Default: stack, depth 2. Exception: PRs that touch the statute file or gate code (the existing review:human / gate-self classes) use queue. Reuse the existing serial-batch stacking machinery: we:scripts/lane-stack.mjs, we:scripts/readiness/overlap-chain.mjs, and the drain's proof-of-land ordering. CI runs on the full stack. When the predecessor changes or merges, the stacked PR is re-based automatically. Declare per we:config/platformDefaults.ts and we:config/defineConfig.ts (config-extends-platform-default, next to the delivery-flow policy keys of card xcs4nce). Done when: unit tests cover queue vs stack, the depth cap, the statute/gate exception, and restack on predecessor change; live proof on a real overlapping pair shows the second PR's repair starting before the first merges, with before/after wait times.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
