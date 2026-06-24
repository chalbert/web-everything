---
kind: decision
size: 3
parent: "746"
status: resolved
relatedProject: webdocs
blockedBy: []
dateOpened: "2026-06-18"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: none
preparedDate: "2026-06-23"
codifiedIn: "docs/agent/platform-decisions.md#forward-emit-dedicated-ir"
relatedReport: reports/2026-06-16-forward-component-emit-substrate.md
tags: [webdocs, adapters, polyglot, generation, component-emit]
---

# Dedicated forward-emit IR (Option C) — design a neutral @webeverything emit-purpose contract vs. reuse the ingest `ComponentIR`

The Phase-2 emit-substrate fork de-buried from [#818](/backlog/818-author-mode-emit-substrate-dedicated-forward-emit-purpose-ir/) into its own decision card. The ground is **already researched** — #811 Fork 2, surveyed in [we:reports/2026-06-16-forward-component-emit-substrate.md](../reports/2026-06-16-forward-component-emit-substrate.md) and topic [forward-component-emit-substrate](/research/forward-component-emit-substrate/) — so this prep links the prior art, not re-runs a survey. The call: when WE emits idiomatic per-framework source, does it (a) extend the ingest `ComponentIR` bidirectionally, or (b) author a **dedicated emit-purpose IR** (Option C). Default **(b)**, per #811's lean: the one shipping precedent (Mitosis) built an emit-shaped IR rather than reuse a lossy ingest rep.

## Recommended path at a glance

| Fork | Question | Options | Recommended · alternative · confidence |
|------|----------|---------|----------------------------------------|
| 1 | The canonical emit substrate | (a) extend the ingest `ComponentIR` bidirectionally · (b) a dedicated emit-purpose IR (Option C) | **(b) Option C** · (a) extend `ComponentIR` · **med-high** |

*Supported by default (not part of this fork):* the per-target **#506 conformance badge** attaches to each generated source regardless; the **live render is FUI-hosted** (the docs-rendering boundary); **consume mode needs no component IR at all** (CEM-only) and is unaffected by this call.

## Fork 1 — the canonical forward-emit substrate

*Fork-existence (case (b), forced invariant — name the flawed branch):* the excluded branch is **(a)**. Reusing `ComponentIR` for high-fidelity multi-framework emit means emitting from a representation **deliberately scoped to a lossy, tractable ingest subset** — it cannot carry styling/events/slots/reactivity faithfully for forward output, and the lone shipping precedent (Mitosis) specifically chose **not** to reuse its ingest rep for emit. The two are mutually exclusive *as the canonical substrate*: one IR cannot be both the lossy-ingest pivot and the high-fidelity emit contract without one role degrading the other. So this is a genuine either/or, not support-both.

Crux, pinned to the tree:

- `ComponentIR` is **ingest-only and a deliberately lossy subset.** [we:upgraderEngine.ts:38](../blocks/renderers/upgrader/upgraderEngine.ts#L38) defines it — `name`/`shadow`/`template` plus `intents?`/`notes?` (`notes` is literally "what was inferred, **what was dropped**"). The file header frames it as the *inbound* normalization hub ("flag, don't fake" on what falls outside the tractable subset). Its only forward emit is `generateComponentSource(ir)` at [we:upgraderEngine.ts:135](../blocks/renderers/upgrader/upgraderEngine.ts#L135), which renders **only** the WE declarative `<component>` form — one target, not five frameworks.
- The #818 foundation that **shipped** ([we:authorModeSource.ts](../blocks/renderers/module-service/authorModeSource.ts)) projects `serve()` over the canonical cases × the `ServeForm` set it already emits — `declarative | wc-class | html | jsx | functional` — and explicitly defers the genuinely-new idiomatic Vue/Svelte/Angular emitters and this Option-C IR (its header names #939 as out of scope). So the foundation rides the existing forms; it did **not** lock a substrate for the new per-framework targets.
- **Direct evidence for (b):** per #811's recorded survey ([report](../reports/2026-06-16-forward-component-emit-substrate.md); topic summary), Mitosis's `MitosisComponent` IR is **purpose-built for emit** (a static serializable JSON shape) and is **not** a reused lossy ingest rep — the report cites this as the direct evidence for Option C over reusing `ComponentIR`, and the per-framework template grammars (Vue `v-model`, Svelte `bind:`, Angular `[()]`) confirm a flat declarative tree under-specifies what emit needs.

Options:

- **(a) Extend the ingest `ComponentIR` into a bidirectional hub** — reuse the inbound representation for forward emit. *Merit:* one representation closes the ingest↔emit loop; round-trip symmetry (a block ingested and re-emitted threads one shape). *Against (merit):* it was scoped for *lossy* subset ingest — `notes` records what it **drops** — so it structurally cannot carry the styling/event/slot/reactivity fidelity idiomatic per-framework emit requires; loading it bidirectionally couples two concerns (lossy ingest pivot + high-fidelity emit contract) with conflicting fidelity invariants, so neither stays clean.
- **(b) A dedicated emit-purpose IR (Option C)** — a separate neutral `@webeverything` contract authored for generation. *Merit:* carries exactly what emit needs (a high-fidelity, serializable, generation-shaped representation), matches the only shipping precedent (Mitosis), and keeps ingest and emit as **separate concerns** — each IR holds one invariant, neither degrades the other (the *bias-toward-separation* line: schema/ownership separation, not file count). *Against (merit):* a third neutral IR alongside `ServePathIR` and the ingest `ComponentIR` — the platform carries one more contract surface to keep coherent.

**Bold default: (b) Option C — a dedicated emit-purpose IR.** A forward transpiler wants an emit-shaped IR (Mitosis is the shipping proof), the ingest `ComponentIR` is by definition a lossy subset that drops exactly what high-fidelity emit needs, and separating ingest from emit keeps each contract holding one invariant. This is consistent with #811 Fork 2's recorded lean toward C.

*(a) extend `ComponentIR` — Rejected.* The ingest rep is a deliberately lossy subset (its own `notes` field records drops); reusing it as the canonical high-fidelity emit substrate degrades emit fidelity, and the lone shipping precedent declined exactly this reuse.

**Option C's contract surface & placement.** When built, C is a neutral `@webeverything` emit-purpose contract — the browser-component member of the ratified **#463/#507** [forward-generation-adapters](docs/agent/platform-decisions.md#forward-generation-adapters) family: WE owns the neutral contract (the #463 SoT pattern), the per-framework serializers are forward-adapter artifacts, each generated source is **#506-gated**, and the **live render stays FUI-hosted** (the docs-rendering boundary — WE never renders FUI block code). The per-framework emitters are **author-time devtools providers** behind an explicit-input seam (the [we:CustomAnalyzerRegistry](../blocks/renderers/upgrader/upgraderEngine.ts#L97) shape — caller-owned, no global singleton), not a runtime DI registry.

**Ratification is evidence-gated — do NOT ratify on this prep alone.** #811 ruled "decide with cases, not guess." The #818 foundation shipped, but the idiomatic Vue/Svelte/Angular emitters that would *produce* the per-framework cases — where the flat declarative `<component>` subset "demonstrably stops stretching" — are **still deferred**, so the deciding empirical evidence does not exist yet. This prep brings the fork to Definition of Ready (options + tradeoffs + bold default + skeptic, grounded in the #811 prior art); the **ratify-trigger** is: *ratify (b) once the per-framework idiomatic emitters accumulate real cases showing where the declarative `<component>` subset stops stretching* — those cases shape C's contract right, rather than guessing it today. This is an **evidence trigger, not a backlog edge** (hence no `blockedBy`).

*Skeptic:* **SURVIVES — beat the single-rep / round-trip-symmetry argument.** The strongest case for (a) is maintaining one representation with ingest↔emit round-trip symmetry. It fails on merit, not effort: #811's Mitosis evidence shows an ingest-lossy rep loses emit fidelity (the rep was built to *drop* what doesn't fit a tractable subset — exactly the styling/event/reactivity detail emit must preserve), so "one rep" buys symmetry at the cost of the fidelity the fork exists to deliver. (a) also violates *bias-toward-separation* (two concerns — lossy ingest pivot and high-fidelity emit — forced into one schema with conflicting invariants). The cost-of-a-third-IR objection is a prioritization/effort tell, not a merit branch — stripped. Default (b) holds.

## Ruling (2026-06-24 — ratified)

**Fork 1 → (b) Option C, the *direction*, is ratified.** The browser-component emit substrate is a dedicated
emit-purpose IR (a neutral `@webeverything` contract authored for generation), **not** a bidirectionally-extended
ingest `ComponentIR`. Settled on **principle, not cases**: the ingest rep is a deliberately lossy subset (its
`notes` field records what it drops — exactly the styling/event/reactivity detail emit must preserve), so reusing
it degrades emit fidelity and forces two conflicting invariants into one schema (*bias-toward-separation*). The
single shipping precedent (Mitosis) declined the same reuse. Red-team of (a)'s single-rep / round-trip-symmetry
case failed on merit (symmetry buys nothing the lossy rep can deliver); the third-IR cost is an effort tell, not
a merit branch. (a) Rejected.

**Direction vs shape split.** What's ratified is the *direction* (emit ≠ ingest IR), which the lossy-by-design
principle decides without empirical cases. Option C's **contract shape** (its fields/grammar) stays **held on the
evidence trigger** — designed once the idiomatic Vue/Svelte/Angular emitters accumulate real cases. This is the
*separate-canonicity-from-content-freeze* move: the structural call is ratified now; the content is held. Tracked
as the parked residual card [#1735](/backlog/1735-design-option-c-s-emit-purpose-ir-contract-shape-held-on-per/). Codified at
[we:platform-decisions.md#forward-emit-dedicated-ir](docs/agent/platform-decisions.md#forward-emit-dedicated-ir).

## Context

- **`blockedBy` reconciliation:** the prior `blockedBy: ["818"]` is removed. #818 is now **resolved** ([818](/backlog/818-author-mode-emit-substrate-dedicated-forward-emit-purpose-ir/)), so that edge no longer blocks, and the real ratify-gate is **downstream per-framework-emitter evidence** — documented above as a trigger, not modeled as an edge to a phantom node (the *Resolved Blocker = Maybe False Edge* lesson: a cleared `blockedBy` is no longer a blocker, and the genuine gate here is empirical, not a backlog node).
- **Prior art (already researched — not re-surveyed here):** [we:reports/2026-06-16-forward-component-emit-substrate.md](../reports/2026-06-16-forward-component-emit-substrate.md) and `/research/` topic [forward-component-emit-substrate](/research/forward-component-emit-substrate/). Set as this item's `relatedReport`.
- **Downstream:** #753 (the polyglot panel) consumes the eventual author-mode per-framework emitters; the residual transport/attachment wiring is [#1618](/backlog/1618-wire-the-we-author-mode-source-artifact-into-the-live-fui-wo/).
