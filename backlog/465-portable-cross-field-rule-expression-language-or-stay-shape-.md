---
type: decision
workItem: story
size: 5
status: resolved
blockedBy: ["304"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
preparedDate: "2026-06-13"
tags: [validation, decision, intents, cross-field, rule-language, cel]
relatedProject: webvalidation
relatedReport: reports/2026-06-13-portable-cross-field-rule-language.md
crossRef: { url: /projects/webvalidation/, label: Web Validation project }
---

# Cross-field rule representation — single CEL pivot, boundary-open adapters

The prepared binary ("portable rule-language **vs** stay shape-only") **dissolved in discussion** (2026-06-13). Two collapses: (1) shape-only-vs-compiler-bearing was a **cost asymmetry**, and *cost is prioritization, not a fork branch* — so the portable Mode-1 build is a separately-prioritized spin-off ([#504](/backlog/504-build-portable-mode-1-cross-field-layer-cel-pivot-boundary-o/)), codified in [backlog-workflow.md](../docs/agent/backlog-workflow.md) → *"a fork is not a prioritization tool"*; (2) a contract needs **one canonical internal form**, so the single-pivot is a forced invariant and the only weigh is *which* pivot. Grounded in the [research topic](/research/portable-cross-field-rule-language/) (report via `relatedReport`).

## Ruling at a glance

| Element | Disposition |
|---|---|
| Mode-2 (server) cross-field | **Forced invariant** — authoritative home, available now |
| Mode-1 cross-field in the v1 contract | **Optional, advertised, flag-lossy** capability — never mandated |
| Internal rule representation | **Forced single canonical pivot** — a contract needs one form |
| *Which* pivot | **CEL** — the one genuine on-merit pick |
| Ingest / emit (boundary) formats | **Open** — adapters normalize in/out of the CEL pivot |
| Portable Mode-1 build | Ratified **end-state**; a spin-off whose *priority* is burndown ordering, **not** a fork |

## Why the prepared binary dissolved

The prepared item framed two forks; discussion collapsed both into invariants + one choice:

- **Old Fork 1 (shape-only contract vs compiler-bearing contract) — dissolved.** A fork decides the *best end-state on merit*; the gap between the two branches was **cost** (a compiler in every adapter slice now, vs later), and cost is a **prioritization** input applied at *what-do-we-work-on-next* time, never a branch inside a design decision. Both sides agree portable Mode-1 cross-field is the desirable end-state — so there is no design either/or, only a **ruling (build it) + a backlog ordering (when)**. The "Option B" of *mandating* cross-field on every adapter is separately rejected on principle (below), not on cost.
- **Old Fork 2 (which representation) — narrowed, not "support all".** A WE-compliant component must carry **one** canonical internal form for the rule (otherwise nothing's comparable and there's no single lock), so the single-pivot is a **forced invariant**, and the only genuine weigh is *which* pivot. Project-facing **boundary** formats stay open — that openness lives at the edges, not the spine.

## Forced invariants (ratify, not weigh)

- **Mode-2 is the authoritative home for cross-field, always available.** Settled in the 2026-06-06 report (RFC 9457 `problem+json` + precognition). Cross-field is never absent from the platform — at worst it is server-evaluated.
- **Mode-1 cross-field is an optional, advertised, flag-lossy capability — never mandated.** `cross-field`/`conditional` are already *optional* features in the manifest ([capability-manifest/provider.ts:48-50](../capability-manifest/provider.ts#L48-L50), "absence is reportable, never a silent no-op"); Plateau tooling routes on the advertisement. *Mandating* it on every adapter contradicts the advertise-partial-compliance-and-select model — that's why "compiler in the v1 contract for all adapters" is rejected on **principle**, independent of cost.
- **The contract carries one canonical internal representation.** A neutral pivot is required for the cross-field rule the component holds and that capability-advertising compares against. Single pivot = forced; *which* pivot is the one real choice below.
- **Boundaries are open.** What a project authors in / a tool generates / a forward adapter emits to is **unconstrained**: an **ingest** adapter normalizes any source format *into* the pivot (adapter-as-normalization-hub); a **forward** adapter transpiles the pivot *out* to each target idiom (`.refine()`, `model_validator`, HTML + inline JS). Any-format at the edges, one form on the spine. (most-permissive-default.)
- **Transpile-to-native vs embed-an-evaluator is the adapter's choice.** Whether an adapter inlines a CEL evaluator or transpiles the rule at emit time is an implementation detail; the contract stays representation-neutral. Support both.

## The one genuine choice — which internal pivot?

**Default: CEL.** The pivot must be a single canonical form; the weigh is purely which one — and the bar is higher for an *internal pivot* than for a boundary format, because the component may **run** it and forward adapters must **transpile** it predictably.

- **Option A — CEL (recommended).** Google's Common Expression Language: non-Turing-complete, linear-time, cross-field via `&&` (`this.start <= this.end`). Official Go/C++/Java/Python runtimes (`cel-expr-python` open-sourced Mar 2026) + community JS/TS evaluators (`cel-js`, `@marcbachmann/cel-js` zero-dep, tree-shakeable). protovalidate proves it across 5 languages at v1.0 with **no codegen**. Best fit for a *pivot* specifically: (a) a real **evaluable** expression language (the component can run it client-side), (b) backed by **cross-language runtimes** (forward adapters transpile predictably), (c) **non-Turing-complete** (safe to embed and analyze). Borrow-official-vocabulary discipline (`Intl.Collator`/`aria-sort`), and the **single escapable lock** (transpile out, or degrade to Mode-2). *Tradeoff:* each JS target embeds or transpiles a CEL evaluator (bundle cost); browser CEL libs are community-maintained, not yet a single blessed runtime.
- **Option B — mint a minimal WE rule AST.** *Rejected:* a private format that **still** needs an evaluator written per language — strictly worse than reusing CEL; lock-in for no interop gain.
- **Option C — JSONLogic.** *Rejected as the pivot (fine as a boundary format):* portable JSON-AST with broad coverage, but weaker typing, no real spec/ecosystem, verbose nested JSON. Keep as a pragmatic ingest/emit target normalized into CEL — not the canonical form.
- **Option D — JSON-Schema conditionals only.** *Rejected for the headline case:* `if/then/else` + `dependentRequired` express only *presence* dependencies, not value-comparison (`endDate > startDate`). A lossy optimization where a target is JSON-Schema-shaped, not the pivot.

**Default: Option A — CEL.** Confidence high for the choice of pivot; the residual (how hard to lean on community browser CEL runtimes vs transpiling CEL → native idioms at emit) is an **adapter-implementation** detail, not a contract clause.

---

## On resolution

Ratifying records: the v1 `CustomValidationAdapter` contract requires **shape intents only**; cross-field is an **optional, advertised** capability defaulting to **Mode-2**; the portable Mode-1 layer's **canonical internal representation = CEL**, with **boundary formats open** (ingest/forward adapters normalize in/out). It spawns a **spin-off build** (CEL pivot + ingest/forward cross-field adapters) `blockedBy` this decision — a *wanted end-state* whose **priority is normal burndown ordering, not a gate**.

## Context

**Where this sits.** Decision under epic [#085](/backlog/085-validation-adapters-multi-language/) (validation generation — protocol + adapters); foundation shipped in [#304](/backlog/304-validation-generation-foundation-intent-enumeration-customva/) (intent enumeration + `CustomValidationAdapterRegistry`, the resolved blocker). The shipped v1 vocabulary is **shape-only**: 13 closed intents in [validation-generation/provider.ts:39-58](../validation-generation/provider.ts#L39-L58), each statically emittable to every Mode-1 target; the only predicate escape hatch today is the **non-portable** `custom` intent ([provider.ts:57](../validation-generation/provider.ts#L57)). The adapter contract (`intents[]` + `emit()`) is [provider.ts:135-147](../validation-generation/provider.ts#L135-L147). The degradation/compliance seam rides on the [#005](/backlog/005-validation-spec-versioning-adherence-tooling/) capability-manifest meta-layer. The sibling field-error-shape intent is [#464](/backlog/464-validation-field-error-shape-intent-pointer-rule-message/). Validity-model semantics (merge strategy, etc.) are owned by [#004](/backlog/004-validation-engine-open-design-points/) and orthogonal.

**Prior art (full detail in the [research topic](/research/portable-cross-field-rule-language/)).** CEL/protovalidate (portable rule language, 5-language parity, no codegen); Laravel Precognition + RFC 9457 (Mode-2, settled); JSON Schema `if/then/else`/`dependentRequired` (presence-only, can't compare values); JSONLogic (portable but weak); Standard Schema (TS interface, not a rule language); CUE (config altitude, out).
