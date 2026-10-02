---
kind: story
size: 8
parent: "4376"
status: open
scope: ["we:scripts/conveyor/", "we:scripts/operations/", "we:scripts/lib/dispatch-routing-policy.json"]
dateOpened: "2026-10-01"
tags: []
---

# Route review fixes and CI heals to Codex (split from #3311)

Acceptance spec for all round-2 and round-3 fix/CI-heal findings from PR #3311: read security tags and risk:high from the owning repository card for BOTH review fixes and CI heals; missing/unreadable cards fail closed, and sibling repositories stay on Claude until they have their own critical-work gate (never read a colliding WE card). Exercise the fix/ci-heal by WE/Frontier UI/Plateau App matrix, item-less repairs, colliding sibling cards, and real security/high/low metadata. Limit the Codex sandbox to the assigned lane and narrowly scoped protocol writes; do not grant broad write access to shared fix-claim or completion stores. Release claims on definite pre-launch failures including plain launch errors proven not to have started a worker and ENOENT; retain and observe claims on indeterminate launches, missing PID and unknown provider errors, preserving certainty and original cause through createDispatchSinks so another tick cannot duplicate a worker. Honor reasoned explicit model overrides on the Codex path and record the actual provider/model/effort. Maintain detached-worker claim liveness during native listing failures without releasing native claims on an unknown listing. Prove these boundaries with regression tests and an end-to-end dry run before enabling repair routing. Existing Claude repair dispatch covers fixes and CI heals until this story ships.

## Done when

1. Add and pass `npx vitest run` targeted at we:scripts/operations/__tests__/repair-routing-review-fixes.test.mjs covering every acceptance boundary in the digest, including actual launch argv, stored model/effort, and claim state across successive ticks.
2. Must refuse unsafe or unclassifiable repairs before launch, with no broad shared-store sandbox grant.
3. Must apply the same security/risk gate to source, docs, config, and data scopes, including missing-card and cross-repository cases.
4. Demonstrate the repair lifecycle end to end in an isolated lane before changing production routing.
