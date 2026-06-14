---
type: idea
locus: exercise-app
workItem: story
size: 3
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: lifecycle
tags: [exercise-app, loan-origination, lifecycle, phase]
---

# Phase S2 — application lifecycle state machine + guards

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). The application
moves `draft → submitted → processing → underwriting → approved-with-conditions → clear-to-close | declined`
with role-scoped, guarded transitions. Drives the **lifecycle/workflow-state** candidate standard ([#353])
— build it (or consume it once it exists) rather than hand-rolling the state machine.

## Progress (resolved 2026-06-14)

The standard ([#353] → `weblifecycle`/`lifecycle`) and its runtime block ([#391] →
`blocks/lifecycle/LifecycleProvider.ts`) already exist and the loan app already *registered* and
*transitioned* against them. S2 completed the two functional gaps that made it a real guarded,
role-scoped state machine rather than a permissive one:

- **Real guard resolution** — wired a `GuardResolver` into the loan's `DefaultLifecycleProvider`
  ([demos/loan-origination/app.ts](../demos/loan-origination/app.ts)) that evaluates the definition's
  named guards against live domain state: `meets-eligibility` → the rules engine has not found the file
  `ineligible` (gates underwriting → approved-with-conditions); `conditions-cleared` → every PTD/PTC
  condition is `cleared`/`waived` (gates approved → clear-to-close). Unknown entity/guard → deny (safe).
  The resolver reads the entity by loan number via a `lookupApp` populated at boot from the pipeline.
- **Role-scoped transitions** — replaced the single hard-coded `underwriter` actor with `availableMoves()`,
  which surfaces every edge out of the current state **labelled with the role the lifecycle permits**
  (borrower / processor / underwriter) and fires each transition AS that role. The provider re-checks
  actor + guard on apply.
- Guards covered by the block's own unit tests; the demo adds the wiring. Smoke (Playwright, live
  `:3000`): an *ineligible* underwriting loan correctly offers only Suspend/Decline (the `meets-eligibility`
  guard hides Approve), and firing Suspend transitions the status chip Underwriting → Suspended, auto-audited,
  no console errors.

Gate: `check:standards` 0 errors; `check:app-conformance` compliant (lifecycle OK, 0 FAIL; the 1 GAP is
the pre-existing `notification` draft). Demo typechecks clean.
