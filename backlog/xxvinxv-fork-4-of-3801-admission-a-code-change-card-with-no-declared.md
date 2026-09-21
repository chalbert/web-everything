---
kind: story
size: 3
parent: "3717"
status: open
blockedBy: ["xlq2jh7", "x00f4mm", "xi8dngi"]
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs", "we:scripts/operations/dispatch-lane.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Fork 4 of #3801, admission: a code-change card with no declared size is held and auto-prepared for a size, unless the operator set default-size; a deliveryAgent marker never bypasses the hold

Ruled in #3801 Fork 4 (b) and Fork 5: the dispatch gate becomes scope plus size, not the preparedDate stamp. Today the gate is scope only: we:scripts/readiness/dispatch-plan.mjs holds an unscoped card unshaped-no-scope and we:scripts/conveyor/tick-core.mjs auto-prepares it, while an unsized but scoped card is dispatched on the assumed 13 band. Under unsizedCardPolicy: block a build card with no size (story) or no estimate field (task) is held with its own reason and sent to prepare, the same way; under default-size it is admitted and records sized: false. Admission is decided before routing, so a card with a deliveryAgent: marker is held too. fix and ci-heal are exempt: they take the fixSizeSource chain.

**Home:** the prototype branch `lane/mechanical-dispatcher`. `we:scripts/readiness/dispatch-plan.mjs` and `we:scripts/conveyor/tick-core.mjs` also exist on `main`; the change is made to the branch copies, where the size policy lives. Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**Order:** `blockedBy` the policy slice (the setting it reads), the field slice (a task's estimate) and the prepare slice (so a held card can actually be prepared for a size before the hold goes live). The wider stamp-required gate (#3801 follow-up 3) is not this slice.

## Done when

1. **Executable** — `npx vitest run we:scripts/readiness/__tests__/dispatch-plan.test.mjs we:scripts/conveyor/__tests__/tick-core.test.mjs` passes with new cases that fail before: (a) under `block`, a scoped `build` story with no `size:` and a scoped task with no estimate field are each held with their own no-size reason and planned for prepare; (b) the same card with a `deliveryAgent:` marker is still held; (c) under `default-size` the card is admitted and its route records `sized: false`; (d) a `fix` and a `ci-heal` are never held for size.
2. **Executable** — `npm run check:standards` reports 0 errors on the branch.
