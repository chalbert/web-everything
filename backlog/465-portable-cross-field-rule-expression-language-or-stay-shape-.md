---
type: decision
workItem: story
size: 5
status: open
blockedBy: ["304"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
preparedDate: "2026-06-13"
tags: [validation, decision, intents, cross-field, rule-language, cel]
relatedProject: webvalidation
relatedReport: reports/2026-06-13-portable-cross-field-rule-language.md
crossRef: { url: /projects/webvalidation/, label: Web Validation project }
---

# Portable cross-field rule-expression language, or stay shape-only

Prepared — no design exists yet; the two forks below are grounded in the published [`portable-cross-field-rule-language`](/research/portable-cross-field-rule-language/) research topic (report via `relatedReport`), each carrying a **bold** default. The survey **reshaped the item**: the original binary ("portable rule-language vs shape-only") split into a *scope* fork and a *representation* fork once it surfaced that Mode-2 already settles cross-field — so it is never "missing," and the real call is whether to *also* invest in portable *Mode-1* cross-field, and in what form.

## Framing — three orthogonal axes

The shipped v1 generation vocabulary is **shape-only**: 13 closed intents in [validation-generation/provider.ts:39-58](validation-generation/provider.ts#L39-L58), each statically emittable to every Mode-1 target. The concern decomposes into three orthogonal axes: **(1) scope** — is cross-field in-scope for static Mode-1 emission at all, or Mode-2-only (server-authoritative)? The Mode-2 home is already settled (RFC 9457 `problem+json` + precognition, per the 2026-06-06 report). **(2) representation** — *if* portable Mode-1 cross-field is pursued, what neutral form carries the rule? The only predicate escape hatch today is the **non-portable** `custom` intent ([provider.ts:57](validation-generation/provider.ts#L57)). **(3) contract impact** — adopting a portable layer means `CustomValidationAdapter` ([provider.ts:135-147](validation-generation/provider.ts#L135-L147)) gains an expression compiler: `emit()` ([provider.ts:146](validation-generation/provider.ts#L146)) must translate a neutral rule into each target's idiom. The graceful-degradation seam is **already in place** — `cross-field`/`conditional` are *optional* capability features in [capability-manifest/provider.ts:48-50](capability-manifest/provider.ts#L48-L50) ("absence is reportable, never a silent no-op"), so support can be per-adapter and flag-lossy, not an all-or-nothing contract requirement.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — Mode-1 cross-field scope** | **Stay shape-only-required in the v1 contract; cross-field is an opt-in adapter capability, server-evaluated (Mode-2) by default; portable Mode-1 cross-field is a deferred opt-in layer** | Build portable cross-field into the v1 adapter contract now (every adapter carries a compiler) | High |
| **2 — Representation (for the deferred layer)** | **Adopt CEL** — reuse the proven multi-language interop language | Mint a minimal WE rule AST · JSONLogic · JSON-Schema-conditionals-only | Med-high |

## Supported by default / forced invariants (not forks)

- **Mode-2 is the authoritative home for cross-field, always available.** Settled in the 2026-06-06 report (RFC 9457 + precognition). Cross-field is never absent from the platform — at worst it is server-evaluated. This is a **ratify**, not a weigh.
- **Unsupported cross-field is flagged-lossy, never silently dropped.** The `$vocabulary`-style required/optional manifest ([capability-manifest/provider.ts:48-50](capability-manifest/provider.ts#L48-L50)) already governs this. Forced invariant.
- **Transpile-to-native vs embed-a-runtime is the adapter's choice.** Whether an adapter inlines a CEL evaluator or transpiles the rule to `.refine()`/`model_validator` is an implementation detail; the contract stays representation-neutral. Support both — not a decision.

## Fork 1 — Mode-1 cross-field scope: shape-only contract, or compiler-bearing contract?

**Crux.** Today every adapter declares an `intents[]` compliance surface ([provider.ts:144](validation-generation/provider.ts#L144)) over a shape-only vocabulary. Putting *portable cross-field* into the v1 contract means each of the generation slices (#305–#309) must carry an expression compiler now. The alternative keeps the contract lean and routes cross-field to Mode-2 until/unless a portable layer is added later. Both branches are coherent and they are mutually exclusive *for v1 scope* — a genuine either/or with a real cost asymmetry.

- **Option A — shape-only-required core; cross-field opt-in + Mode-2 default (recommended).** The v1 `CustomValidationAdapter` contract requires only shape intents; cross-field is an *optional* per-adapter capability (the manifest seam already supports declaring it). Cross-field that no adapter emits statically is server-evaluated via Mode-2. *Tradeoff:* offline/no-network static cross-field isn't available until the deferred layer ships — acceptable, because the most common cross-field needs (confirm-password, date-order) are low-stakes client-side niceties whose authoritative check is server-side anyway. Aligns with native-first (Mode-2/server is the default), most-permissive-default (the standard imposes no compiler requirement), and minimize-lock-in.
- **Option B — compiler-bearing contract now.** Bake a portable rule layer into the v1 contract so cross-field emits statically to all Mode-1 targets immediately (protovalidate-style parity). *Tradeoff:* imposes an expression-compiler burden on every adapter slice up front, raises the bar for "be a conforming adapter," and front-loads the heaviest part of the design before any consumer demands offline cross-field. Higher fidelity, higher cost, earlier lock-in to a representation.

**Default: Option A.** *Rejected — Option B:* over-builds the contract ahead of demand and makes static cross-field a baseline obligation when Mode-2 already covers the need; revisit only if a concrete consumer needs offline value-comparison cross-field.

## Fork 2 — Representation of the (deferred) portable rule layer

**Crux.** *If/when* portable Mode-1 cross-field is built (the deferred layer in Fork 1-A, or immediately under 1-B), the rule needs a neutral representation that `emit()` can translate to each target. Pre-settling this keeps the deferred build agent-ready. The survey ([research topic](/research/portable-cross-field-rule-language/)) makes the choice fairly clear, with some residual divergence on how far it reaches.

- **Option A — adopt CEL (recommended).** Google's Common Expression Language: non-Turing-complete, linear-time, cross-field via `&&` (`this.start <= this.end`). Official Go/C++/Java/Python runtimes (`cel-expr-python` open-sourced Mar 2026) + community JS/TS evaluators (`cel-js`, `@marcbachmann/cel-js` zero-dep, tree-shakeable). protovalidate proves it across 5 languages at v1.0 with no codegen. Reusing it is the borrow-official-vocabulary discipline (`Intl.Collator`/`aria-sort`). *Tradeoff:* each JS target embeds or transpiles a CEL evaluator (bundle cost); browser CEL libs are community-maintained, not yet a single blessed runtime.
- **Option B — mint a minimal WE rule AST.** *Rejected:* a project-facing expression format is exactly the lock-in WE refuses when a proven external standard exists — lock-in for no interop gain.
- **Option C — JSONLogic.** *Rejected as the standard (viable fallback):* portable JSON-AST with broad language coverage, but weaker typing, no real spec/ecosystem, and verbose nested-JSON syntax. Keep as a pragmatic emit target, not the neutral source-of-truth.
- **Option D — JSON-Schema-conditionals-only.** *Rejected for the headline case:* `if/then/else` + `dependentRequired` survive shape-schema codegen but only express *presence* dependencies — they cannot do value-comparison cross-field (`endDate > startDate`). Use them where a target is JSON-Schema-shaped and the rule happens to be presence-only, as a lossy optimization under CEL, not the representation.

**Default: Option A — adopt CEL.** Confidence med-high: CEL is clearly the right external standard; the residual judgment is how aggressively to lean on still-maturing browser CEL runtimes vs transpiling CEL → native idioms at emit time (an adapter-implementation choice, see Context).

---

## Context

**Where this sits.** Decision under epic [#085](/backlog/085-validation-adapters-multi-language/) (validation generation — protocol + adapters); foundation shipped in [#304](/backlog/304-validation-generation-foundation-intent-enumeration-customva/) (intent enumeration + `CustomValidationAdapterRegistry`, the resolved blocker). The degradation/compliance seam rides on the [#005](/backlog/005-validation-spec-versioning-adherence-tooling/) capability-manifest meta-layer. The sibling field-error-shape intent is [#464](/backlog/464-validation-field-error-shape-intent-pointer-rule-message/). Validity-model semantics (merge strategy, etc.) are owned by [#004](/backlog/004-validation-engine-open-design-points/) and orthogonal to this fork.

**On resolution.** Ratifying Fork 1-A leaves the portable layer as a deferred build to be scaffolded when demanded (a `blockedBy` spin-off off this decision); ratifying Fork 2-A pins that build's representation to CEL up front, so the spin-off is agent-ready. Ratifying 1-B would instead spawn the compiler-bearing-contract build immediately.

**Prior art (full detail in the [research topic](/research/portable-cross-field-rule-language/)).** CEL/protovalidate (portable rule language, 5-language parity, no codegen); Laravel Precognition + RFC 9457 (Mode-2, settled); JSON Schema `if/then/else`/`dependentRequired` (presence-only, can't compare values); JSONLogic (portable but weak); Standard Schema (TS interface, not a rule language); CUE (config altitude, out).
