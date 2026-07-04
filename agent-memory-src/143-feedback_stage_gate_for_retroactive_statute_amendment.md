---
name: feedback_stage_gate_for_retroactive_statute_amendment
description: "A statute amendment whose new gate would retroactively invalidate existing entries STAGES the gate — codify policy now, enforce with the migration waves, never flip it on at ratification."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3fc0014c-2e7a-43fe-affc-d8796eaecd03
---

When ratifying a decision that amends a statute AND introduces a `check:standards` gate that would
**retroactively** mark existing entries non-conformant, the codify step authors the **policy + skeleton +
boilerplate only** — it does **not** wire the enforcing gate at ratification. Observed 2026-07-02 ratifying
#2096 (spec register): Fork 3 made every `active` standard owe a normative spec, and all 76 current actives
had none. Flipping the `active ⇒ spec required` gate on immediately would have red-barred the whole repo for
work not yet done.

**Why:** the enforcing gate and the migration work are separable. Landing the gate before the migration turns
a green repo red for obligations that can't be met yet, and a red gate blocks every concurrent session.
Ratification settles the *policy*; enforcement is a rollout concern that follows the enumerated migration
work-list (here, the per-category #2079 authoring waves).

**How to apply:** at ratify time, if the ruling adds a gate keyed on existing entries' state, (1) confirm the
item explicitly stages enforcement (codify policy, defer the gate), (2) write that staging into the ruling so
codification doesn't wire the gate now, (3) hand the gate to the first migration wave, enforced incrementally
as each completes. If the ruling is silent on this, red-team it *before* ratifying — it is the highest-leverage
failure mode of a retroactive statute change. Relates to the WE statute layer (platform-decisions.md
`codifiedIn`) and the shared-tree hazards in [[shared-index-commit-race]].
