# Spec-based programming — how to specify specs for AI agents (initial survey)

*Session report, 2026-07-18. Grounds #2563 Fork 1 (narrow the trust-chain human gate to spec changes) and the
broader spec-based-programming direction (`x0n1nax`). A deeper multi-source, adversarially-verified research
pass is in flight and will be attached to `x0n1nax` when it lands; this is the initial survey.*

## Why

We want a review gate where **a change to a spec always needs a human, but the implementation under a spec can
be tweaked by an AI agent alone if an independent review agrees the spec is preserved** (the Kiro / GitHub
Spec-Kit model). For our gate-self case that turns the human trigger from "any edit to a trust-chain *path*"
into "an edit to the trust-chain *spec*." For that to be a **deterministic** yes/no (not an agent judging its
own leash-edit), the spec must be an explicit, diffable, human-owned artifact.

## The landscape

- **GitHub Spec Kit** — MIT CLI (`specify`), the most-adopted 2026 spec-driven tool. Four-phase markdown loop
  (`/specify` → `/plan` → `/tasks` → `/implement`) producing a *constitution* doc (durable principles), a
  *spec* doc (behavior only), a *plan* doc, and a *tasks* doc under a `.specify/` folder, a branch per spec.
  Spec↔code separation is **by convention**, not enforced. ([spec-kit](https://github.com/github/spec-kit))
- **AWS Kiro** — agentic IDE; three docs per feature under `.kiro/specs/`: a *requirements* doc in **EARS**
  notation (5 constrained templates, e.g. "When X the system shall Y"), a *design* doc, a *tasks* doc,
  committed next to code; the human approves each doc before it advances.
  ([kiro.dev](https://kiro.dev/docs/specs/feature-specs/), [EARS](https://alistairmavin.com/ears/))
- **Tessl** — the purest "spec *is* the source of truth": per-file spec docs, code marked GENERATED-FROM-SPEC,
  a versioned Spec Registry. Still beta; admits regeneration is non-deterministic.
  ([tessl.io](https://tessl.io/blog/from-code-centric-to-spec-centric/))
- **BMAD-METHOD**, OpenSpec, spec modes in Cursor / Cline / Aider — thinner wrappers over the same markdown-spec
  idea. Neutral cross-tool review: [Fowler / Böckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html).

## The load-bearing finding — prose vs contract

**Every popular AI-spec tool uses a *prose* spec, validated by a human reading a text-diff. None mechanically
detects whether the spec changed** (Fowler: no tool auto-detects drift or validates spec changes
automatically). That is fatal for a *deterministic* gate — a wording change may or may not alter meaning, and
only human/agent interpretation can tell. The deterministic alternative is the older **contract-as-spec**
family, which the AI-spec tools skip:

| Spec form | Human-readable | "Did the spec change?" is… | Executable |
|---|---|---|---|
| Prose markdown / EARS (Kiro, Spec-Kit) | high | interpreted — **not** deterministic | no |
| **Schema-as-spec** (JSON Schema, TypeSpec, OpenAPI) | medium | **mechanical** — structural diff | validate/conformance |
| **Gherkin / property tests** | high | **mechanical** — run the suite (green/red) | yes |
| Formal (TLA+, Alloy) | low | mechanical — model-check | yes (invariants only) |
| ADR / RFC | high | text-diff only | no |

Granularity has split: Spec-Kit/Kiro = per-feature; Tessl = per-file; BMAD = per-story. No tool has a strong
drift-detection story — sync is "regenerate and hope" or manual.

## Net for our two cases

- **(a) Review-gate policy spec (#2563 Fork 1)** — make the escalation policy a **typed/executable contract,
  not prose**: a schema for the thresholds + reason sets + disposition, plus a conformance suite. The
  independent review answers "spec preserved?" by *running it* (deterministic); human review is reserved for a
  diff of the contract file. Our policy is *already* nearly this (`DEFAULT_THRESHOLDS`, the reason sets,
  `deriveReviewDisposition`'s branches), so it's a small extraction, not a rewrite.
- **(b) Broader constellation direction (`x0n1nax`)** — layer it: human-owned *intent* in structured
  markdown / EARS **for reading**, but the **gate** is the machine-checkable contract (TypeSpec / JSON Schema
  at repo boundaries; formal methods for the few real invariants). Adopt Spec-Kit/Kiro's file-separation +
  per-feature discipline; do **not** inherit their "spec = interpreted prose" — the non-deterministic part.
  Aligns with the constellation's existing spec-vs-impl split (WE holds the standard, FUI/plateau hold the
  impl).

**Ratified in discussion (2026-07-18): the spec is a schema/contract, not prose.**

*Caveat: nearly all named AI-spec tools are 2025–26 vintage and heavily marketed; the "spec" they ship is
model-interpreted prose. Only the schema/formal family is mechanically checkable today. The in-flight deep
research pass will pressure-test these claims across more sources.*
