# Validation Generation: Protocol + Adapters, and the Two Delivery Modes

**Date:** 2026-06-06
**Scope:** The *generation* layer of validation only — protocol + adapters that emit validation from a single intent declaration. Deliberately excludes the validity-model semantics (owned by [backlog #004](../backlog/004-validation-engine-open-design-points.md)), the conformance/versioning meta-layer (owned by [#005](../backlog/005-validation-spec-versioning-adherence-tooling.md)), and all UI / component-integration concerns. Companion to the [form-validation standard assessment](./2026-05-30-form-validation-standard-assessment.md).
**Method:** Targeted web survey of shipped prior art (7 angles → ~20 sources). Primary sources: Buf/protovalidate, Laravel docs, JSON Schema 2020-12 spec, standardschema.dev, IETF RFC 9457, Pydantic/datamodel-code-generator.
**Goal:** Validate the two-mode framing in [#085](../backlog/085-validation-adapters-multi-language.md), find the strongest existing model for each mode, and answer (or sharpen) its open decisions — especially the Mode-2 wire format and how an adapter "exposes which intents it complies with."

---

## Executive summary

**The two-mode framing is correct and both modes are already shipped patterns — WE's contribution is not inventing them but unifying them under one intent vocabulary with declared compliance.** Each mode has a clear, mature exemplar:

- **Mode 1 (single-source generation, no runtime link)** is best embodied by **protovalidate** (Buf): you declare rules once on a Protobuf schema and they are *enforced* — same semantics — in Go, TypeScript, Java, Python, and C++. This is the gold standard for "declare once, run in the language you use," and it proves the model works at v1.0 production scale (Microsoft, GitLab, Nike…). A more pragmatic, lower-fidelity variant is **JSON-Schema-as-source + per-target codegen** (`datamodel-code-generator` → Pydantic, `quicktype` → TS).
- **Mode 2 (backend exposes validation as a service)** is best embodied by **Laravel Precognition**: the backend runs its *real* validation rules without executing the controller, and returns the result for the front-end to do live validation. This answers a question the backlog item left open — the de-facto wire format is already settled in practice: **HTTP 422 + an error body** (and RFC 9457 is the standard envelope for it).
- **The "declare which intents you comply with" mechanism has a direct precedent in JSON Schema's `$vocabulary`** — a dialect declares which vocabularies it *requires* vs. treats as *optional*, and a conforming implementation **must refuse** a schema using a required vocabulary it doesn't recognize. That is almost exactly #085's "enumerate intents; adapters comply with a subset and expose it; unsupported = flagged not silent." We should model the compliance manifest on it.

One **gap worth claiming**: RFC 9457 standardizes the *error envelope* (`application/problem+json` with `type/title/status`) but explicitly does **not** standardize the field-level validation-error shape — it leaves `errors[]` to convention. A WE Validation protocol could define that shape normatively as a first-class intent.

---

## 1. The two modes are genuinely distinct — and both have shipped exemplars

| | **Mode 1 — single-source generation** | **Mode 2 — validation-as-a-service** |
|---|---|---|
| Where rules run | Independently in FE *and* BE, no runtime link | Authoritatively in the BE; FE *asks* |
| Coupling | Build-time only (one source → N artifacts) | Runtime (network round-trip per check) |
| Exemplar | **protovalidate** (CEL on proto → Go/TS/Java/Py/C++) | **Laravel Precognition** (run rules, skip controller) |
| Failure if drift | Impossible by construction (one source) | Impossible by construction (one runtime) |
| Cost | Build step / codegen per target | Latency + availability of the BE per keystroke |
| Offline / no-network | Works | Does not (FE depends on BE) |
| Best when | Strong typing per language, no network on validate | Rules are secret/complex/server-only, or change often |

The two are not competitors — they're different points on a *where-does-the-rule-execute* axis, which is exactly why WE should offer both rather than enforce one (the native-first, flexibility-first stance).

## 2. Mode 1 deep dive — three sub-patterns, descending fidelity

There isn't one "single-source" pattern; the prior art splits into three, and #085's adapters could support more than one:

1. **One rule language, compiled/interpreted in many runtimes (highest fidelity).**
   protovalidate puts rules in **CEL** (Common Expression Language); the *same expression* (`this.a + this.b < duration('48h')`) evaluates identically across all five languages. Fidelity is near-total because the *logic*, not just the *shape*, is shared. Cost: every target must embed a CEL runtime.
2. **One declarative schema, codegen per target (pragmatic).**
   JSON Schema as the source; `datamodel-code-generator` emits Pydantic/dataclasses/TypedDict, `quicktype` emits TypeScript, etc. Fidelity is bounded by what each target can express — `$ref/allOf/oneOf/anyOf` survive, but custom/cross-field logic often doesn't. This is the **lossy** case #085 already anticipates.
3. **One library interface, many consumers (TS-only today).**
   **Standard Schema** — a ~60-line TypeScript interface implemented by Zod, Valibot, ArkType, Effect Schema. It doesn't generate anything; it lets *tools* (tRPC, TanStack Form/Router) consume any compliant schema without an adapter per library. Its framing is the key insight: it **reduces the adapter problem from N×M to N+M**. That is the architectural argument for WE standardizing the *intent interface* rather than a matrix of point-to-point converters.

**Implication for #085:** the registry should treat "rule language" (CEL-style) and "shape schema" (JSON-Schema-style) as *different adapter capabilities*, both expressible as intents, with the manifest declaring which a given adapter supports. Don't assume all targets can express cross-field logic.

## 3. Mode 2 deep dive — Precognition is the reference design

Laravel Precognition is the most complete shipped version of "backend exposes validation as a service":

- A "precognitive" request runs **all middleware + the real form-request validation rules**, then **returns before executing the controller** — no DB writes, no side effects.
- Pass → **204 No Content**; fail → **422 Unprocessable Entity** with the validation errors.
- The FE debounces field changes and sends precognitive requests, yielding **live validation powered by the exact server rules** — zero rule duplication.
- Rules can be **conditioned on precognition** (`isPrecognitive()`): e.g. skip the expensive "password not in breach list" check during live validation, run it only on final submit. This is a real-world nuance #085's Mode 2 should accommodate — *partial* rule sets per phase.

**Wire-format finding (answers an open decision):** in practice the format is **HTTP status (422/204) + an error body**, not a bespoke schema. The body should be **RFC 9457 `application/problem+json`**. So #085's "format(s) plural, TBD" can be narrowed: *default to RFC 9457 problem+json; allow a richer Validation-Protocol-native JSON as an opt-in negotiated format.* The negotiation mechanism is standard HTTP content negotiation (`Accept`).

## 4. Exposing intent-compliance — model it on JSON Schema `$vocabulary`

#085 says "adapters/formats comply with *some* intents and expose their compliance." The cleanest existing model is JSON Schema's vocabulary system:

- A dialect's meta-schema lists vocabularies in **`$vocabulary`**, each marked **required (`true`)** or **optional (`false`)**.
- An implementation that doesn't recognize a **required** vocabulary **must refuse** the schema; an unrecognized **optional** one may be ignored (annotations only).
- Core is always required (it bootstraps the system).

Mapped onto WE: the **set of validation intents = the vocabulary universe**; an **adapter's capability manifest = its `$vocabulary`-style declaration** of which intents it supports; an intent it can't express is the "unrecognized required vocabulary" case → **flagged lossy / refused, never silently dropped**. This is precisely the [#005](../backlog/005-validation-spec-versioning-adherence-tooling.md) capability-manifest (`{specVersion, conformanceLevel, features[]}`) — so #085 should *consume* #005's manifest and borrow JSON Schema's required/optional distinction for the semantics.

## 5. Communicating results — standards, and a gap to claim

- **RFC 9457 — Problem Details for HTTP APIs** (2023; obsoletes 7807) is the wire envelope: `application/problem+json` with required `type`/`title`/`status`, plus extensions. Consumers must ignore unknown extensions (forward-compatible).
- **The gap:** RFC 9457 *explicitly does not* define the field-level validation-error shape — the common `errors: [{ detail, pointer }]` pattern is convention, "work it out with your clients." A WE Validation protocol could **standardize that field-error intent** (pointer + rule + message), which is squarely in-charter for an interop vocabulary and not covered by any existing standard.
- **User-facing communication (out of #085's scope, noted for completeness):** native CSS `:user-invalid`/`:user-valid`, ARIA `aria-invalid`/`aria-errormessage`/`aria-describedby`, and WCAG 3.3.x are the standards for *showing* errors. #085 explicitly excludes UI, so these belong to the (separate) presentation layer — but the *generated* artifact should carry enough (pointer + message) to drive them.

## Actions feeding #085 (and where they land)

1. **Narrow the Mode-2 wire-format decision:** default **RFC 9457 `problem+json`**, opt-in richer native format via `Accept` negotiation. (Update #085's open decision.)
2. **Model the compliance manifest on `$vocabulary`** (required/optional intents), consuming #005's manifest. (Cross-link #085 ↔ #005.)
3. **Recognize three Mode-1 fidelities** in the registry design (rule-language vs shape-schema vs interface-consumer); don't assume cross-field logic is portable. (Informs the registry/adapter contract.)
4. **Consider a new intent: the field-error shape** (pointer + rule + message) — the RFC 9457 gap. (Candidate for the Validation protocol vocabulary; raise as its own backlog item if pursued.)
5. **Evaluate adopting/bridging Standard Schema** as a first-class Mode-1 interface target for the TS ecosystem (N+M argument). (Open decision in #085.)

## Open questions remaining → backlog

- Should WE define its own neutral rule-expression language (CEL-like) for portable cross-field logic, or stay shape-only and accept that cross-field rules are Mode-2-only? (Fidelity vs. complexity.)
- Is the field-error shape (action #4) part of *this* standard's generation output, or a sibling "validation reporting" protocol?
- For Mode 2, do we standardize the *precognition* idea (run-rules-without-side-effects) as a protocol behavior, or treat it as an implementation detail of the service adapter?

---

## Sources

- [protovalidate (Buf) — Protobuf validation across Go/Java/Python/C++/JS-TS](https://github.com/bufbuild/protovalidate) · [Protovalidate is now v1.0](https://buf.build/blog/protovalidate-v1)
- [Laravel Precognition (12.x docs)](https://laravel.com/docs/12.x/precognition)
- [Standard Schema](https://standardschema.dev/schema) · [Standard Schema explained (OpenReplay)](https://blog.openreplay.com/standard-schema-explained-flexible-validation/)
- [JSON Schema 2020-12 — `$vocabulary` (Learn JSON Schema)](https://www.learnjsonschema.com/2020-12/core/vocabulary/) · [Dialect & vocabulary declaration](https://json-schema.org/understanding-json-schema/reference/schema)
- [RFC 9457 — Problem Details for HTTP APIs (IETF)](https://datatracker.ietf.org/doc/html/rfc9457)
- [datamodel-code-generator (JSON Schema → Pydantic/TypedDict)](https://github.com/koxudaxi/datamodel-code-generator)
- [Schema-driven form validation (LogRocket)](https://blog.logrocket.com/stop-fighting-schema-driven-form-validation/) · [Syncing front-end/back-end validation (GeeksforGeeks)](https://www.geeksforgeeks.org/how-to-sync-front-end-and-back-end-validation/)
