---
type: idea
workItem: story
size: 8
status: open
dateOpened: "2026-06-06"
tags: [validation, protocol, adapters, multi-language, codegen, validation-as-a-service, conformance, intents, native-first]
relatedProject: webvalidation
relatedReport: reports/2026-06-06-validation-generation-protocol-adapters.md
crossRef: { url: /projects/webvalidation/, label: Web Validation project }
---

# Validation generation — protocol + adapters that emit validation, two ways

A **protocol-and-adapter system whose only job is to *generate* validation** from the Web Validation vocabulary — not to render UI, not to wire it into any component, not to be a runtime engine. You declare validation once against the standard's **intents**; **adapters** materialize those intents as runnable constraints. As with every Web Everything standard, we **do not enforce a single way** — we enumerate the possible intents and offer **at least two delivery modes**, each backed by adapters/formats that declare *which* intents they comply with.

## Scope — and explicit non-goals

This standard is **purely the generation layer**: intents → adapter → emitted validation artifact. Everything about *using* that artifact is out of scope and owned elsewhere.

| In scope | Out of scope (owned elsewhere) |
|---|---|
| The validation **intents** (the neutral vocabulary of what can be constrained) | The **UI** / how errors look (component pages, messaging) |
| **Adapters** that emit those intents into a target language/format | **Integrating** the result into a component or form |
| Each adapter/format **declaring + exposing** which intents it complies with | A **runtime validation engine** — we generate, we don't run |
| **Two+ delivery modes** for getting the emitted validation to consumers | The **validity model semantics** (merge, tiers) — that's #004 |

## Two delivery modes — flexibility, not one enforced way

The same intent declaration can be delivered two fundamentally different ways. A consumer picks the mode that fits their stack; both are first-class.

### Mode 1 — single-source generation (no runtime link)
Generate the validation from **one source into both a front-end and a back-end language**. The two emitted artifacts are **independent** — there is no runtime communication between them; they're just provably-the-same rules because they came from one declaration. This is the "declare once, get it in the FE and BE language you use" case.

- Output: idiomatic source per target (e.g. native HTML constraint attrs, TS/Zod, Python/Pydantic, JSON Schema).
- Guarantee: FE and BE emissions share **one declaration core**, so they can't drift — but they ship and run separately.

### Mode 2 — backend exposes validation as a service
The **backend exposes its validation as a service** the front-end (or any consumer) queries, rather than re-generating it client-side. The wire **format is undetermined and likely plural** — to be settled — so the service can speak whichever format a consumer's adapter understands.

- Output: a served validation description in one of N negotiated formats.
- Open: which format(s) — JSON Schema, a Validation-Protocol-native JSON, RFC 9457 problem-shapes for failures, etc. **Plural by design**, format chosen by content negotiation / adapter support.

> More modes may follow (e.g. build-time file emission vs. serve-time endpoint within Mode 1). The point is the **set is open**, like the rest of WE.

## The meta-pattern — enumerate intents, declare compliance with a subset

Like many WE standards, this **standardizes the meta-schema, not a fixed list**. We define the universe of **validation intents**; each **format/adapter complies with *some* of them and exposes that compliance** — so a consumer can see, before using an adapter, exactly which intents it honors and which it can't express.

- A constraint a target can't express is **flagged lossy with a diagnostic — never silently dropped**.
- "Declares which intents it complies with" is exactly the **#005 capability manifest** (`{specVersion, conformanceLevel, features[]}`), applied per-intent. This item *consumes* that mechanism; it doesn't reinvent it.
- New intents and new adapters are **additive registry entries**, not core forks (`CustomValidationAdapterRegistry`, same inject-a-provider shape as `CustomRenderStrategyRegistry` and the MaaS `CustomCompilerRegistry` in #081).

## Research (2026-06-06) — both modes are shipped patterns; actions

Full survey in [reports/2026-06-06-validation-generation-protocol-adapters.md](../reports/2026-06-06-validation-generation-protocol-adapters.md) (also at [/research/](/research/) → *Validation Generation*). Key findings:

- **The two-mode framing is correct and both modes already ship** — WE's job is to unify them under one intent vocabulary with declared compliance, not invent them.
  - **Mode 1 exemplar: protovalidate** (CEL on Protobuf → identical rules in Go/TS/Java/Python/C++) — the gold standard for "declare once, run in your language." Pragmatic lossier variant: JSON-Schema-as-source + codegen (`datamodel-code-generator`, `quicktype`). TS-only interface variant: **Standard Schema** (reduces adapters N×M → N+M).
  - **Mode 2 exemplar: Laravel Precognition** — runs the *real* server rules without executing the controller, returns `422`+errors for live FE validation.
- **Three Mode-1 fidelities exist** (portable rule-language vs. shape-schema codegen vs. interface-consumer) — the registry must not assume cross-field logic is portable.

**Actions this resolves / sharpens:**
- ✅ **Mode-2 wire format** narrowed: default **RFC 9457 `application/problem+json`**, richer formats via `Accept` negotiation (was "plural, TBD").
- ✅ **Compliance exposure** has a model: JSON Schema **`$vocabulary`** (required/optional intents; refuse unrecognized required) → maps onto the #005 manifest.
- 🔲 **New candidate intent — field-error shape** (pointer + rule + message): RFC 9457 standardizes the envelope but *not* the field-level shape — a gap WE could claim. Raise as its own item if pursued.
- 🔲 **Decide:** define a portable rule-expression language (CEL-like) for cross-field logic, or stay shape-only and treat cross-field as Mode-2-only.

## Distinct from the existing validation items

| Item | Owns | This item does **not** re-cover |
|---|---|---|
| #004 — validity-model & conformance tiers | *What* validity is (source-reduction vs flat; L0/L1/L2) | the semantic model — adapters emit *to* whatever #004 settles |
| #005 — spec-versioning + capability adherence | *Whether* an impl conforms (declare + verify features) | the conformance meta-layer — each adapter **declares compliance via #005** |
| **#085 (this)** | *How* intents become emitted validation, in ≥2 delivery modes | — |

## Native-first baseline

The built-in default adapter emits to the **web platform's own constraint validation** — `required`, `min`/`max`, `pattern`, `type`, `ElementInternals.setValidity` — so a consumer with no library and no build step still gets real, generated validation. Library/format adapters (Zod, Pydantic, JSON Schema, the Mode-2 service formats) are **opt-in enhancements**, never a precondition.

## Candidate first adapters (Mode 1)

Target the **schema layer, not the UI framework** (React/Vue/Svelte all consume the same schema lib via resolvers):
- **Native HTML constraint validation** — Tier 0, mandatory.
- **TypeScript + Zod** — dominant FE lib; doubles as the Node BE (proves same-language full-stack).
- **Python + Pydantic** — most common cross-language BE (proves FE-TS / BE-Python).
- **JSON Schema** — interchange; also the likely first Mode-2 service format.
- *(Later, as registry entries: Go `validator`/struct tags, Jakarta Bean Validation, Standard Schema interop.)*

## Open decisions (recommendations in **bold**)

- **Intent source format.** **Reuse the existing Validation Intent vocabulary as the neutral source — do not invent a new DSL.** JSON Schema becomes *one emitted target*, not the source of truth.
- **Mode 2 wire format.** *(narrowed by 2026-06-06 research)* **Default to RFC 9457 `application/problem+json`; allow a richer Validation-Protocol-native JSON as an opt-in format via standard `Accept` content negotiation.** Precognition shows the de-facto contract is already `422`/`204` + an error body.
- **Single-source guarantee (Mode 1).** **FE and BE emissions must call one shared declaration core**, so rules can't drift between independently-shipped artifacts.
- **Compliance exposure.** **Every adapter/format publishes a #005 capability manifest enumerating the intents it complies with; out-of-capability intents are lossy-flagged.**
- **Async / cross-field / custom rules.** **Out of v1** — fold into #004 and a later phase; v1 is the declarative, statically-emittable intent set.

## Dependencies / sequencing

1. **#004** — validity-model settled (adapters emit *to* it).
2. **#005** — capability-manifest schema (how each adapter declares its intent compliance).
3. **The intent enumeration** + `CustomValidationAdapterRegistry` (meta-schema + extension seam).
4. **Mode 1 first** (native HTML + Zod + Pydantic + JSON Schema from one core), then **Mode 2** (service + first negotiated format).

## Acceptance (v1 proof-of-concept)

- One intent declaration emits, **Mode 1**, to **≥3 targets** (native HTML, Zod, Pydantic) from **one shared core**; adding a 4th is a registry entry.
- **Mode 2** stands up: a backend serves its validation in **≥1 negotiated format**, with the format chosen by the consumer's adapter.
- Each adapter/format **exposes its intent-compliance** (#005 manifest); an unsupported intent is **lossy-flagged with a diagnostic**, never silently dropped.
- A fixture-driven demo shows the **same declaration** delivered both ways (per the repo's Definition of Done).
