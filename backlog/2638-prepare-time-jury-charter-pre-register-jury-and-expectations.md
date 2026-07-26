---
bornAs: xjnmv6d
kind: story
size: 5
buildQueued: true
parent: "2636"
status: resolved
blockedBy: ["2634"]
scope: ["we:skills-src/prepare-decision-item/", "we:scripts/lib/review-core.mjs"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-26"
dateResolved: "2026-07-26"
tags: []
---

# Prepare-time jury charter: pre-register jury and expectations for early human alignment

The early-human-alignment gate (settled design call). At prepare/claim, author a *provisional* jury plus each juror's up-front expectation as an artifact on the item — so the human aligns on the review bar **before** any code is written, and the pre-registered expectations kill post-hoc goalpost-moving. **Care-gated**: aligning every juror up front is real cost, so skip it for `low` care and only run it for elevated/high (reuse the same care dial that sizes rigor). Wire the charter authoring into the prepare/claim path (`we:skills-src/prepare-decision-item/`) and derive the provisional roster from `we:scripts/lib/review-core.mjs`. Depends on the lens/method split for what a juror *is*.

## Progress

- `we:scripts/lib/review-core.mjs` — the prepare-time jury charter (pure, single-sourced):
  - `LENS_EXPECTATIONS` + `expectationForLens` — the pre-registered up-front bar per lens (all `PANEL_LENSES` +
    `PERSPECTIVE_LENSES`), one generalized sentence each; the wording IS the commitment the human aligns on and the
    juror is later held to (kills post-hoc goalpost-moving).
  - `JURY_CHARTER_CARE_FLOOR` (`elevated`) + `shouldRegisterJury(careLevel)` — the care gate: register only for
    elevated/high, skip low/none (reuses the same care dial that sizes rigor); unknown care-level throws.
  - `buildJuryCharter({ careLevel, changedFiles })` — derives the PROVISIONAL roster from the SAME
    `resolveJuryPlan` → `materializeRoster` the open-time jury uses (not a parallel guess), attaching each juror's
    expectation. Below the floor returns an un-registered charter with the skip reason (never throws). Binds against
    the item's PREDICTED touch-set (its `scope:`); #2636 re-checks against the real diff at open.
  - `renderJuryCharter(charter)` — the markdown artifact embedded on the item (a `### Review jury (provisional)`
    juror/lens/method/expectation table, or a one-line skip note below the floor).
- `we:skills-src/prepare-decision-item/SKILL.md` — new pass 6 wires charter authoring into the prepare path
  (care-gated: estimate the care band → `buildJuryCharter` with the predicted touch-set → embed `renderJuryCharter`).
- Tests added to `we:scripts/lib/__tests__/review-core.test.mjs` (care gate, per-lens expectations, provisional
  roster incl. the diverse high-care jury, the skip path, and the rendered artifact); `check:standards` green.
