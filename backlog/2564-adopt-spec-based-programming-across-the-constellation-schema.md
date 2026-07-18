---
bornAs: x0n1nax
kind: decision
status: open
dateOpened: "2026-07-18"
relatedReport: reports/2026-07-18-spec-based-programming-deep-research.md
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

## Layered governance — constitution → spec/law → implementation (2026-07-18)

The model is a **three-tier amendability hierarchy**, borrowed from jurisprudence — each tier derived from
the one above, each with its own gate:

- **Constitution** — the core principles that must *never* be breached (e.g. the non-author invariant; WE
  holds zero implementation; segregation of duties over the review leash). It is **not directly applicable to
  a diff** — too abstract to check code against; it is the *source* from which laws are derived. Amending it
  is the highest-stakes act: a **constitutional-amendment gate** — rare, deliberate, the strongest human
  ratification (potentially more than one human).
- **Spec = law / statute** — machine-checkable contracts **derived from** the constitution and **directly
  applicable** to code (the schema + conformance layer). A spec change is human-gated (#2563 Fork 1) and
  carries a second obligation: at authoring/amendment time it is checked for **constitutional consistency** —
  *that* is where the constitution is applied, not at code review.
- **Implementation** — derived from a fixed spec; agent-clearable on conformance-green + independent
  (AI-panel) review.

**The load-bearing rule: the constitution is never applied to a case directly.** You never gate a diff against
the constitution — only against the derived spec/law. Constitutional consistency is verified when a *law/spec*
is written or amended, never when code is reviewed (a court applies the statute; it tests the statute against
the constitution only when the statute itself is challenged).

Maps onto what we already have: `we:docs/agent/platform-decisions.md` is the statute/law layer (the "Platform
Decisions = Statute Layer" rule); the FOUNDATIONAL core invariants are a proto-constitution; GitHub Spec Kit's
`constitution` file and Anthropic's Constitutional AI are precedents for a named principle layer — though
Constitutional AI applies its constitution more *directly* (as critique principles), whereas this model is
stricter: constitution → derived law → application. **Open:** the exact constitutional-amendment gate (how
many humans, what ceremony), and whether constitutional-consistency of a new spec/law can be even partly
machine-assisted or is wholly a human judgment.

## Deep research — landed 2026-07-18

Adversarially-verified (22 sources → 25 claims → 22 confirmed, 3 refuted; 104 agents). Full report:
`we:reports/2026-07-18-spec-based-programming-deep-research.md`. Verdict: the direction is **validated with
named prior art**; the space is real but **< 18 months old** and mostly "spec-first" maturity — adopting it
means **assembling** the discipline (schema spec + contract tests + CI gate + authority tiers), not buying one
tool.

Load-bearing findings:

- **Prose specs (Spec-Kit / Kiro) are not machine-diffable; schema-as-spec is.** TypeSpec → OpenAPI / JSON
  Schema / Protobuf gives a mechanical "did the contract change?" — confirming the schema-not-prose ruling.
  Formal methods (TLA+) are machine-checkable for *syntax* only, and LLMs author them badly (8.6% semantic),
  reinforcing human-authors-spec / agent-implements.
- **Specmatic's central-contract-repository pattern ≈ the constellation, one-to-one.** Contracts live in ONE
  repo (WE); downstream repos **reference and never own** them (FUI/plateau); cross-boundary changes gate on a
  human-reviewed PR + backward-compat check on the contract repo, plus a conformance suite in the service
  repos. Answers *where specs live* (centrally, per-boundary-contract) and *how to gate cross-boundary changes*.
- **A published design already unifies #2563 + #2564 — the "Spec Growth Engine" (arXiv 2606.27045).** It
  splits merge authority **by blast radius** (boundary/contract changes → HARD human; internal refactors →
  AUTO) and makes drift a **blocking merge condition** via a deterministic Intent-Graph-vs-Evidence-Graph diff.
  This is #2563 Fork 1 + blast-radius, fused. *Blueprint only — single-author, unimplemented preprint.*
- **Two hard limits to design around.** (1) A green conformance suite proves *code matches spec*, never *spec
  is right* — so a human on every spec change + an independent review agent are non-negotiable. (2) The
  Productivity-Reliability Paradox: raw agent throughput inflates review cost without improving delivery (METR
  RCT: 19% slowdown) — which is the case for the *keep-changes-small* nudge and the contract gate over a better
  generator.

## Open forks (for `/prepare`)

1. **Which WE-owned artifact is the central contract** — do the existing intent/protocol definitions *become*
   the machine-diffable spec, or is a schema layer (TypeSpec → JSON Schema) authored above them?
2. **Granularity + the mechanical contract-line** — per-boundary-contract (fits Specmatic + blast-radius
   authority) vs per-feature vs per-file; and how the "contract-level line" that forces HARD human review is
   identified *mechanically*, not by convention.
3. **The independent-review agent's false-clear rate is unquantified** — no source measures a second AI
   reviewer's reliability on impl-only changes; the auto-clear path's residual risk is unmeasured.
4. **The non-executable slice** — drift is only mechanically detectable for the executable part; prose intent /
   EARS / semantic invariants leave a governance gap.

## Related

First instance: #2563 (blast-radius advisory; Fork 1 narrows the trust-chain human gate to *spec* changes) —
the Spec Growth Engine shows these are one design. Composes with the constellation placement model (WE =
standard/spec, FUI/plateau = impl) and the agent-convergence independent-validation rule. NOT ready to ratify —
needs `/prepare` (author the four forks above against this research).
