---
type: decision
workItem: story
size: 3
parent: "099"
status: parked
dateOpened: "2026-06-15"
tags: [requirement-as-code, meta-schema, bdd, conformance, webcases, evergreen]
crossRef: { url: /backlog/100-requirement-as-code/, label: "Requirement-as-code (#100)" }
---

# Requirement meta-schema — BDD-like format & relationship to webcases

Ratify the requirement-as-code meta-schema: the BDD-like intent/role/state vocabulary (standardize the format, not a fixed requirement list) and the requirements-compile-to-cases relationship to webcases. Placement settled by [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/) (Plateau-served AI capabilities; only the meta-schema + webcases reach the standard). Gating design fork for [#100](/backlog/100-requirement-as-code/) / the strong evergreen-app vision ([#099](/backlog/099-evergreen-app-vision/)).

## Why this is a parked decision card

This fork was previously buried in #100's body as "Design notes (**recommended**)". `/split 100`
(2026-06-15) ruled #100 un-splittable precisely because slice A's core — the meta-schema **format** — is
an unratified fork (rubric (1): you can't split away a fork). Filed here as its own `type:decision` card
so the fork is tracked rather than carried inline (a design fork is a backlog decision item, never a buried checkbox).

**Parked, not open:** the requirement-as-code capability is a far-future vision-tier ingredient of the
evergreen app. Deferral governs *when* we ratify, not *whether* the fork is tracked. The card un-parks
when slice A (the authoring + validation editor) is picked up as a near-term standalone win — at which
point ratify the format here, then build slice A against it.

## Forks to ratify

1. **Meta-schema format / vocabulary** (the live, undecided call). Standardize the *format* — a BDD-like
   shape over the constellation's existing vocabulary (intents = UX, protocols = conformance contracts),
   not a fixed requirement list (mirrors the intents "standardize the meta-schema, not the list"
   principle). *Recommendation:* an intent/role/state grammar that binds requirements to the standard so
   they're verifiable by construction (generic BDD has no ground truth; here the standard *is* the ground
   truth).
2. **Relationship to webcases.** Is a requirement a higher-level thing that *compiles down to* cases, or
   a sibling? *Recommendation:* requirements **compile to** cases, so the existing
   [webcases](../webcases/) suite stays the executable layer (one machine-checkable target, not two).
3. **AI-provider placement — already resolved, recorded for completeness.** Per [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/)
   no-leakage: the contradiction/ambiguity checker and the test-generator are Plateau-served swappable
   providers the tool consumes as a no-leakage client; only the requirement **meta-schema** and the
   **webcases** they compile to are WE-resident artifacts. *Not an open branch.*

## Unblocks

Once ratified: land foundational **slice A** (authoring + validation editor — produces the requirement
corpus everything else needs) as a standalone win, then re-run `/split 100` to carve the auto-testing
loop (slice B) and code-from-requirement (slice C) against the now-real tree.
