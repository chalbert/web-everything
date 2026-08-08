---
bornAs: xi6f2f8
kind: story
size: 5
parent: "2612"
status: open
dateOpened: "2026-08-02"
blockedBy: ["2989"]   # 2989 decouples the couple-join from the ready-to-merge scope; this item's `ready-to-merge` strip is only SAFE once carrier health is read from the blind context (reciprocal of 2989's "Blocks #2832"). The drain renumbers this hash → NNN at land.
tags: [conveyor, orchestrator-mechanization, drain, review, ci-lifecycle, gate]
---

# Label/hold self-consistency — a review-hold label must auto-strip ready-to-merge at write time (constellation-wide)

`ready-to-merge` and the review-hold labels (`review:human` / `review:pending` / `review:changes`) can sit on the SAME PR at the same time. The CI-green auto-stamp adds `ready-to-merge` on green regardless of review state, so a held PR ends up carrying both — a go-ahead and a hold at once. Labels must be self-consistent BY CONSTRUCTION: whenever any review-hold label is present, `ready-to-merge` is auto-stripped (or refused) at the moment a label is written and at CI-stamp time — enforced in BOTH the WE drain and the plateau-app drain (`tools/drain-daemon/`).

## The concrete gap — what the main session did by hand tonight

The two label families are not mutually exclusive, and the CI-green stamp is blind to review state. So the main session had to intervene by hand, repeatedly:

- **Hand-stripped `ready-to-merge` 4 times** to keep held PRs from being collected. The strip is not durable — the CI-lifecycle reconcile re-adds `ready-to-merge` on the next green while the review gate is still unsatisfied — so the manual strip is a race against the reconcile, not a lock.
- **The plateau-app drain merged #134 anyway.** The plateau-app drain (`tools/drain-daemon/`) has the same coexistence bug and no self-consistency guard, so a held PR that carried a stray `ready-to-merge` was landed with no human review.

Both are the same root shape: a PR can hold a hold and a go-ahead simultaneously, and some consumer downstream honors the go-ahead.

## Why this blocks a session-free conveyor

A purely mechanical conveyor cannot rely on a human standing by to strip a mislabeled PR before a drain collects it. If a hold and a go-ahead can coexist, then every drain pass across the constellation is one race away from landing a held PR — exactly what happened to plateau-app #134. For the conveyor to run with no main-session judgment, the label state itself must be incapable of expressing "held AND ready" — the inconsistency must be unrepresentable, not hand-corrected after the fact.

## The mechanical fix

Make the two label families self-consistent by construction, at WRITE time (not by a downstream reader remembering to check):

- **On writing any review-hold label** (`review:pending` / `review:changes` / `review:human`), atomically strip `ready-to-merge` in the same operation.
- **At CI-stamp time**, the green-CI auto-stamp REFUSES to add `ready-to-merge` while any review-hold label is present (and the reconcile never re-adds it while a hold stands).
- **Enforce in BOTH drains** — the WE drain AND the plateau-app drain (`tools/drain-daemon/`) — so the invariant holds constellation-wide, not just in one repo.

The result: no label-timing race can leave a PR carrying both a hold and `ready-to-merge`, so no manual strip is ever needed and no drain can collect a held PR.

## Relationship to #2820

#2820 fixes the merge DECISION — the merge predicate refuses to merge any PR bearing an unsatisfied review label, regardless of `ready-to-merge`. This item extends that with LABEL-STATE consistency: it stops the contradictory state from ever existing (defense-in-depth item #2 of #2820, generalized to write-time and to the whole constellation). The two compose: #2820 makes the merge safe even if the labels lie; this makes the labels unable to lie. Both are needed for a session-free conveyor — #2820 as the durable source of truth, this as the invariant that removes the re-add race and covers every label consumer, not just the merger. Scope is **constellation-wide**: WE drain + plateau-app `tools/drain-daemon/`.

## Acceptance

- Writing any review-hold label (`review:pending` / `review:changes` / `review:human`) onto a PR that carries `ready-to-merge` atomically strips `ready-to-merge` in the same operation.
- The green-CI auto-stamp does NOT apply `ready-to-merge` while any review-hold label is present, and the reconcile does not re-add it while a hold stands.
- The invariant is enforced in BOTH the WE drain and the plateau-app drain (`tools/drain-daemon/`).
- Regression: reproduce the plateau-app #134 scenario — a held PR that acquires a stray `ready-to-merge` is auto-corrected (the go-ahead is stripped) and is NOT collected by the drain.
- No main-session hand-strip is required for a held PR to stay held across CI-green reconcile passes.
