---
bornAs: xxvinxv
kind: story
size: 3
parent: "3717"
status: resolved
blockedBy: ["3843", "3839", "3842"]
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs", "we:scripts/operations/dispatch-lane.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
graduatedTo: none
tags: []
---

# Fork 4 of #3801, admission: a code-change card with no declared size is held and auto-prepared for a size, unless the operator set default-size; a deliveryAgent marker never bypasses the hold

Ruled in #3801 Fork 4 (b) and Fork 5: the dispatch gate becomes scope plus size, not the preparedDate stamp. Today we:scripts/readiness/dispatch-plan.mjs holds only an unscoped card (unshaped-no-scope, auto-prepared by we:scripts/conveyor/tick-core.mjs); an unsized scoped card is dispatched on the assumed 13 band. Under block, a build card with no size (story) or no estimate field (task) is held with its own reason and sent to prepare; under default-size it is admitted with sized: false. A deliveryAgent: marker never bypasses the hold. fix and ci-heal take the fixSizeSource chain instead.

**Home:** the prototype branch `lane/mechanical-dispatcher`. `we:scripts/readiness/dispatch-plan.mjs` and `we:scripts/conveyor/tick-core.mjs` also exist on `main`; the change is made to the branch copies, where the size policy lives. Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**Order:** `blockedBy` the policy slice (the setting it reads), the field slice (a task's estimate) and the prepare slice (so a held card can actually be prepared for a size before the hold goes live). The wider stamp-required gate (#3801 follow-up 3) is not this slice.

## Done when

1. **Executable** — `npx vitest run we:scripts/readiness/__tests__/dispatch-plan.test.mjs we:scripts/conveyor/__tests__/tick-core.test.mjs` passes with new cases that fail before: (a) under `block`, a scoped `build` story with no `size:` and a scoped task with no estimate field are each held with their own no-size reason and planned for prepare; (b) the same card with a `deliveryAgent:` marker is still held; (c) under `default-size` the card is admitted and its route records `sized: false`; (d) a `fix` and a `ci-heal` are never held for size.
2. **Executable** — `npm run check:standards` reports 0 errors on the branch.

> **Verified done, 2026-09-22.** Already built and committed straight to `lane/mechanical-dispatcher` at
> `e3d11b713` ("#3849 (Fork 4 admission of #3801): the dispatch gate becomes scope + size"), ahead of this
> card being picked up. Re-verified: `we:scripts/readiness/__tests__/dispatch-plan.test.mjs` and
> `we:scripts/conveyor/__tests__/tick-core.test.mjs` pass (97 + 164 tests) with the `#3849 admission` /
> NO-SIZE hold cases present. **Criterion 2 caveat:** `npm run check:standards` on the branch tip reports 2
> errors, but both are pre-existing findings in `we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md`
> (a missing locus prefix and an opaque token) unrelated to this card's own scope — not introduced by this
> slice. Resolved here as `graduatedTo: none` — the code is not yet on `main`; it reaches `main` through
> #3443, per this card's own `Home:` section.
