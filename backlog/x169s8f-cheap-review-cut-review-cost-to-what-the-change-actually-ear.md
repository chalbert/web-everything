---
kind: epic
status: open
dateOpened: "2026-08-06"
tags: []
---

# Cheap review: cut review cost to what the change actually earns

Review currently costs far more than it returns on routine internal changes. Cut the cost by making the jury earn its seats — lenses triggered by what the diff touches, findings routed by whether they actually block, and rounds spent only on blockers — while keeping every knob as contract DATA so review stays configurable per project and team later.

## Where the cost is today

A typical machinery PR here trips `blast-radius` (weight 3) → care `elevated` → **four lenses × one juror × two rounds**, plus an editor pass between rounds. That is roughly eight to ten full reads of the same diff. Two of those four lenses rarely pay out on internal work, and the second round exists only to re-check a fix that often did not need making inside the PR.

Three structural causes, each addressed by a slice below:

1. **Every band fans out the same four lenses.** `low`/`elevated`/`high` differ only in rounds and juror count (`panelRigorForCareLevel`, we:scripts/lib/jury-core.mjs). Care buys *duplicate* jurors, not *different* perspectives — `high` runs two copies of one lens, doubling cost while sharing the blind spot.
2. **Any mandatory-lens `changes` bounces the whole PR into a round.** There is no way for a juror to say "real, but not this PR's problem", so every finding is priced as a blocker.
3. **`blast-radius` at weight 3 makes `elevated` the floor.** Its path set covers `scripts/`, skills, agent memory, hooks, CI, statute, and standards defs — which is nearly every PR in this repo.

## The reframe

**The jury should be sized to who else is affected, not to how sensitive the file feels.** A standards definition is a published contract with two repos downstream and is expensive to walk back. A tweak to the drain affects one developer on one laptop and surfaces within a day. Today both land in the same `blast-radius` bucket at the same weight.

And **the bar is better-than-`main`, not perfect.** Jurors judge against an implicit ideal, which is what generates findings that are true, unhelpful, and expensive. Every juror answers three questions before a finding earns anything: was the problem already there, are we net better or worse than `main`, and can it be fixed in parallel.

## Slices

| slice | what it does |
|---|---|
| #x0q5anw | the `solo-dev` profile — earned lenses, re-weighted signals, one juror per lens |
| #xlcmu06 | finding disposition (blocker / carve-out / nit) and blocker-only rounds |
| #xctebq6 | acceptance criteria on items, on a determinism ladder |
| #xm4owlw | the PR evidence block — red before, green after |

## What is deliberately not changed

- **Routing and clearance.** Care level stays advisory. `gate-self` and `statute` still force a human, and the disposition precedence table is untouched — this epic changes how hard the jury looks, never who clears the merge.
- **Aggregation.** Still diversity-selection: the strictest juror carries the panel, never a majority vote (#2567).
- **The contract shape.** Every value here lands in we:scripts/lib/review-policy.contract.json, which already carries per-band `lenses`/`jurorsPerLens`/`roundCap`/`validationMethods` plus `lensWeights`, `dissentThreshold`, and a per-decision override allow-list. Shipping this as a *named profile* rather than new global constants is what makes the eventual per-project and per-team configurability a matter of adding profiles to the same shape.

## Open

- Whether `high` should ever restore a second juror per lens, or should always spend the extra budget on *more lenses and better grounding* instead. Current lean: grounding, since two same-model jurors share their blind spot.
- Whether `validationMethods` (declared in every band, empty in all of them) is the right home for the grounding dial once a band has something real to attach.
