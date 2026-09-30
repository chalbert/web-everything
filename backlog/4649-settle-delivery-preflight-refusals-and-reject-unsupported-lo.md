---
bornAs: xp12azn
kind: story
size: 3
tier: pinned
status: open
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/deliver-item-run.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/deliver-item-settle.mjs", "we:scripts/operations/effect-executor.mjs", "we:scripts/operations/__tests__/effect-executor.test.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/operations/__tests__/deliver-item-run.test.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Settle delivery preflight refusals and reject unsupported loci before spawning

Build #4620 exited on the intentional mixed-repo scope refusal before lane acquisition, outside the wrapper settlement catch. Move unsupported-locus admission before detached launch and make every preflight exit persist its real terminal reason. Preserve the unresolved multi-repo policy in #4289.

## Evidence

we:scripts/operations/deliver-item-wrapper.mjs:371; we:scripts/operations/deliver-item-wrapper.mjs:400; we:scripts/operations/deliver-item-run.mjs:180. Full incident evidence: we:reports/2026-09-30-builder-launch-misread-root-causes.md.

## Design

Share the existing locus capability check with admission; return a typed refusal without spawning unsupported work. Enclose wrapper preflight in terminal settlement as a backstop for older callers and races. Record the original reason and track which resources were actually acquired before cleanup; do not release another owner. Make early-child settlement monotonic against the parent post-spawn handle write. Do not implement multi-repo delivery or ratify #4289.

## Done when

1. A real isolated operation/child-process probe with the #4620 mixed scope rejects before agent spawn and lane acquisition, and writes a typed refusal. An injected wrapper preflight throw with a real temporary run store becomes terminal with its reason preserved, including parent/child write ordering; no unrelated lane lease is released.
2. Soak break: stop changes for at least 30 minutes after deployment to a disposable observer-controlled instance; let at least three normal ticks observe the refusal alongside one supported delivery. Record no repeated unsupported spawns, no ghost in-flight row, and no foreign lease mutation. Preserve the break and before/after evidence in the delivery record.

## Follow-ups

The diagnosis-only lane could not run its gates: the sandbox denied the verifier marker and the standards admission lock. Run both gates in the implementing lane with normal repository permissions; do not bypass either.

Keep serializer-to-consumer and process-lifecycle probes at the real boundary; helper-only fixtures did not reveal this incident. Record testing lessons here, not in shared agent documentation.
