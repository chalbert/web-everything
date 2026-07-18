---
kind: story
size: 5
parent: "2505"
status: open
tags: [plateau-loop, console, console-board, taxonomy, webcases, conformance, zero-impl]
dateOpened: "2026-07-18"
---

# Card-state taxonomy as the maintained conformance spec

The 37-state card taxonomy for the launch-review console (5 families: A lifecycle · B cross-lane span · C
off-lane pool · D terminal · E failure axis) currently lives only as CODE
(`plateau-app:src/backlog-view/card-taxonomy.webcases.ts`, shipped via plateau-app #62) with no WE tracking or
spec. This story makes it the **maintained, cite-able source-of-truth**: the grammar the real board is built
and checked against. Serves G5 (durable, machine-checkable) and is the spec every board slice cites.

Per WE-holds-zero-impl: the **spec + validation live in WE** (definitions + a validate script), the **rendered
cases live in plateau-app** (the webcases + the /console-cases viewer, already shipped).

## Scope
- The 37 states + the ratified visual grammar (color · icon · attention-card · say-it-once · disclosure ·
  progress=crossing) as the definitional spec; the residual forks resolve via [#2544].
- A **validation/coverage** check: every state has a case; every you-act case carries the amber edge + one
  primary verb; the 6 `rendered=pending` states are tracked to `yes` as the board renders them.
- Document the card-state grammar in **webdocs** (design doc §314a).

## Acceptance
The taxonomy is a WE-tracked spec with a validate script; plateau's cases conform to it; the webdocs page
renders the grammar; a board slice ([#2550] C2) can cite a state's spec by UC-id. Distinct from [#2549]
(the viewer registry plumbing) and [#2552] (the real→card-state read-model).
