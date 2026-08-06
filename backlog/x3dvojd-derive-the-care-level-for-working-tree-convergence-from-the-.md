---
kind: story
size: 3
status: open
dateOpened: "2026-08-06"
tags: []
---

# Derive the care level for working-tree convergence from the touch-set

/converge runs on working-tree material, which has no escalation reasons — so the care dial has no signal and falls to low, the weakest panel available (1 round, 1 juror per lens), on work nothing has judged yet. The skill currently tells the operator to pass --care deliberately, which is a documentation patch over a design gap. Derive the band from the change's touch-set instead, so a diff touching a trust boundary, a gate, or a shared derivation earns higher rigor without the operator remembering to ask.

## Where the gap is

`--care` is optional in we:scripts/converge-cli.mjs and defaults to `low`. `panelRigorForCareLevel('low')`
(we:scripts/lib/jury-core.mjs) yields the weakest active panel — **1 round, 1 juror per lens** — against `high`'s
3 rounds and 2 jurors per lens. So the default review is the shallowest one available, on exactly the material
that has never been judged by anything.

For the PR path this problem does not arise: care is derived from the escalation reasons, which only exist for
material that already failed something, so care is high by construction there. Porting the same dial to a
transport with no prior escalation leaves the signal empty, and the current code resolves empty to `low` by
analogy rather than by asking what the right default is for unjudged work.

## The shape of the fix

Two pieces already exist to copy from:

- **`classifyTouchSet`** (we:scripts/lib/review-core.mjs) already turns a changed-file list into the perspective
  lenses a subject earns. The same input can pick a care band.
- **`deriveCareLevel` / `CARE_WEIGHTS` / `CARE_BANDS`** (we:scripts/lib/review-escalation.mjs) already score
  signals (blast radius, size) into a band. That is the derivation shape to adapt for a working-tree diff that
  carries no PR-side signals yet.

Keep it a pure derivation in the core, reached the same way every other one is — the CLI shells for it, the skill
never decides a band by hand.

## Why this is filed separately

The question was raised and left open inside #xztipiw, which shipped and resolved. A resolved item drops out of
selection and its open questions are treated as historical (`findBuriedForkSections` in
we:scripts/check-standards-rules.mjs exempts resolved items from the buried-fork gate), so the question was
captured but no longer actionable. This item makes it selectable again.

## Definition of done

- The care band for `working-tree` is derived, not defaulted, and the derivation is unit-tested.
- The `--care` flag stays available as an explicit override.
- The "pick the care level deliberately" warning in we:skills-src/converge/SKILL.md is replaced by a statement of
  what the derivation does — a prose warning is what this item exists to remove.
