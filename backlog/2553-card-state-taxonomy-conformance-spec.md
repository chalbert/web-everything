---
bornAs: x5nrrw0
kind: story
size: 5
parent: "2505"
status: resolved
locus: plateau-app
tags: [plateau-loop, console, console-board, taxonomy, webcases, conformance]
dateOpened: "2026-07-18"
dateStarted: "2026-07-19"
dateResolved: "2026-07-19"
graduatedTo: "plateau-app:src/backlog-view/card-taxonomy.webcases.ts"
---

# Card-state taxonomy as the maintained conformance spec (plateau-app)

The 37-state card taxonomy for the launch-review console (5 families: A lifecycle · B cross-lane span · C
off-lane pool · D terminal · E failure axis) lives as code in
`plateau-app:src/backlog-view/card-taxonomy.webcases.ts` (shipped via plateau-app #62). This story makes it the
**maintained, cite-able source-of-truth** — the grammar the real board is built and checked against. Serves G5
(durable, machine-checkable) and is the spec every board slice cites.

**Re-scoped (2026-07-19): this lives in plateau-app, NOT WE.** The 37 states are *plateau business logic*
(lanes, leases, drain, scope-breach, policies) — WE holds only reviewed shared primitives, never a single
app's business logic. So the spec + validate + web-docs page harden the **existing plateau-app** artifacts
(the webcases + the `plateau-app:src/backlog-view/card-taxonomy.webcases.test.ts` conformance test + the
`/console-cases` docs renderer). WE holds **no** taxonomy spec; the design record now lives at
`plateau-app:docs/backlog-console-design.md` (moved from `we:docs/design/` this session) and stays the
reference. (See memory: WE standards need a reviewed decision.)

## Scope (all in plateau-app)
- The 37 states + the ratified visual grammar (color · icon · attention-card · say-it-once · disclosure ·
  progress=crossing) hardened as the definitional spec in plateau-app; the residual grammar forks were ruled
  in [#2554] (resolved) — fold the rulings in, incl. the F6 "sub-lanes → across lanes" reword.
- A **validation/coverage** check (extend the shipped conformance test): every state has a case; every you-act
  case carries the amber edge + one primary verb; the 6 `rendered=pending` states are tracked to `yes` as the
  board renders them.
- Document the card-state grammar in **plateau's web-docs** surface (design doc §314a).

## Not in scope / boundary
- **No WE spec or WE validate script.** If the *general* interaction grammar (actor model · one-symbol-one-
  meaning · say-it-once · disclosure · progress=crossing) is ever wanted as a shared WE primitive, that needs a
  **second agent-board consumer** to prove it general and a **reviewed decision to mint it** — OPEN one then;
  do not extract it on the side now (one consumer = plug-when-proven).

## Acceptance
The taxonomy is the maintained, cite-able spec **in plateau-app** with its conformance check green; the
web-docs page renders the grammar; a board slice ([#2555] C2) can cite a state's spec by UC-id. Distinct from
[#2550] (viewer registry plumbing) and [#2552] (the real→card-state read-model).
