---
type: idea
workItem: story
size: 13
parent: "099"
status: open
dateOpened: "2026-06-06"
tags: [requirement-as-code, bdd, ai, verification, evergreen, conformance, editor, spec, propose-and-verify]
relatedReport: reports/2026-06-06-front-end-platform-book.md
relatedProject: webcases
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app (#099)" }
---

# Requirement-as-code — machine-checkable requirements an AI can understand, test, and (eventually) generate from

Capture an app's requirements as a **structured, machine-readable artifact** — plain language but in a BDD-like format — that the Platform AI can reason over, automatically test a growing share of, and eventually generate code from. This is the hardest and most central ingredient of the evergreen app ([#099](/backlog/099-evergreen-app-vision/)): if requirements are formal and verifiable, then auto-update, regeneration, and conformance all have a ground truth to check against. From the essay's *"The evergreen app"* section.

> **Split status (2026-06-10 analysis, via #259): splittable but deferred.** The body already endorses
> a *staging* sequence — requirement meta-schema + authoring/validation editor (`story·5`) → auto-testing
> loop (`story·5`) → code-from-requirement (`story·5`) — an incremental A→B→C delivery. But each slice
> stays ≈`5` (none batchable), so it stages the work without producing batchable wins. Deferred: execute
> the staging split when slice A is actually picked up as a near-term standalone win; revisit with `/split` then.
>
> **Sized 8 → 13 (2026-06-15, batch pre-flight):** each staging slice is single-item/not-batchable
> and the meta-schema design notes are recommended-not-ratified — dropped from the batch pool.

## The three capabilities, in order of difficulty

1. **Authoring + validation (nearest).** A special editor for writing requirements in a constrained natural language; the AI flags **contradictions, ambiguity, and missing requirements** as you write — like a linter for intent. Lowest risk, immediately useful, and produces the corpus everything else needs.
2. **Auto-testing (the moat).** The AI auto-generates conformance tests for the requirements it *can* test; requirements it can't are coded by a dev or the AI is *shown how* to test them, so coverage compounds over time. Each requirement is tagged tested / not-yet-tested and tracked. This is the **propose-and-verify** loop (#095) applied to requirements rather than code.
3. **Code-from-requirement (furthest).** Two shapes: (a) requirement is the *only* source of truth, code generated at build/run time (needs very high confidence); (b) more likely — AI *proposes* a code change from a requirement, a developer validates/edits it. The patternable subset grows as the Platform AI learns.

## Why it's uniquely possible here

The constellation already gives requirements something to bind to: **intents** (UX vocabulary), **protocols** (conformance contracts), and the **webcases** suite (the machine-checkable target). A requirement expressed in that vocabulary is verifiable by construction — generic BDD tools have no ground truth; here the standard *is* the ground truth.

## Design notes (recommended)

- The requirement **meta-schema** — standardize the *format* (BDD-like, intent/role/state vocabulary), not a fixed requirement list (mirrors the intents "standardize the meta-schema" principle).
- Relationship to **webcases**: is a requirement a higher-level thing that *compiles down to* cases, or a sibling? Recommendation: requirements compile to cases, so the existing suite stays the executable layer.
- The AI is a **swappable provider** behind a registry (same shape as #086/#094/#095) — the contradiction/ambiguity checker and the test-generator are providers, not baked-in. **Placement (no-leakage, per [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/)):** these AI *impl capabilities* are Plateau-served services the tool consumes as a no-leakage client; the WE-resident artifacts are the requirement **meta-schema** and the **webcases** they compile to — only those reach the standard.
- This is the gating dependency for the strong form of the evergreen vision; sequence the authoring+validation slice first as a standalone win.
