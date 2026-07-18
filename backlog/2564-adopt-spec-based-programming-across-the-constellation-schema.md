---
bornAs: x0n1nax
kind: decision
status: open
dateOpened: "2026-07-18"
relatedReport: reports/2026-07-18-spec-based-programming-spec-formats.md
tags: [spec-driven, standards, review, architecture, strategy]
---

# Adopt spec-based programming across the constellation — schema/contract specs, human-gates-spec / agent-implements

Strategic direction: move the constellation toward spec-based (spec-driven) programming, Kiro / GitHub
Spec-Kit style, where the **spec is a human-owned artifact** and the **implementation under it can be
generated or tweaked by an AI agent alone** when a conformance suite stays green and an independent review
agrees the spec is preserved. #2563 Fork 1 (a human gates a change to the review-policy *spec*, not the whole
trust-chain path) is the **first concrete instance**; this item is the general direction it previews.

## Ratified in discussion (2026-07-18)

- **The spec is a SCHEMA / executable CONTRACT, not prose.** Only contract-as-spec (JSON Schema / TypeSpec /
  Gherkin / property tests) makes *"did the spec change?"* a **deterministic** yes/no and *"did the impl
  preserve the spec?"* a machine-run conformance check. Prose specs (Kiro, Spec-Kit, Tessl) are validated by a
  human eyeballing a text-diff — no tool auto-detects semantic drift — which is exactly the non-deterministic
  part we must not inherit.
- **The model is human-gates-spec / agent-implements.** A change to the spec always needs a human; an
  implementation change under a fixed spec is agent-clearable on conformance-green + independent review.

## Why it fits us

The constellation is *already* a spec-vs-impl split: WE holds the standard (the spec — intents, protocols,
platform decisions), FUI/plateau hold the implementation. "Spec changes need a human, impl changes are
agent-clearable" is that boundary applied to the review gate — not a foreign model. The near-term win is the
review gate (#2563); the broad win is a programming discipline where the human's attention is spent on the
few spec artifacts, not on every diff.

## Open (to prepare after the research lands)

A deep multi-source research pass is **in flight** (2026-07-18) to ground the forks before this is prepared:

- **Which formalism at which boundary** — schema (JSON Schema / TypeSpec) for typed contracts, Gherkin /
  property tests for behavior, formal methods for the few real invariants, structured prose/EARS for
  human-readable *intent* layered above the machine-checkable gate.
- **Granularity** — per-feature (Spec-Kit / Kiro) vs per-file (Tessl) vs per-boundary-contract (fits the
  constellation's WE↔FUI↔plateau seams).
- **Drift + sync** — how spec↔code stays honest; how a cross-boundary contract change is gated.
- **Migration / adoption pace** — where to start (the review gate is the proposed first instance), and how to
  graduate; real-world evidence of what works and fails; maturity and risks (non-deterministic regeneration,
  over-specification).

## Related

First instance: #2563 (blast-radius advisory; Fork 1 narrows the trust-chain human gate to *spec* changes).
Composes with the constellation placement model (WE = standard/spec, FUI/plateau = impl) and the
agent-convergence independent-validation rule. `relatedReport` to be attached when the deep research lands.
NOT ready to ratify — needs the research + fork authoring (`/prepare`).
