---
kind: story
size: 3
parent: "097"
status: resolved
blockedBy: ["052"]
dateOpened: "2026-06-06"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "demo:mockup-to-standard-demo"
tags: [design-to-code, mockup, ai-agnostic, provider-registry, codegen, standard-compliance, adapters, native-first, swappable-provider]
relatedProject: webadapters
crossRef: { url: /adapters/, label: Rendering Adapters }
---

# Mockup-to-standard-code tool — analyse a UI mockup, emit standard-compliant code, never married to one AI

A tool that **ingests a UI mockup — static (image, Figma) or interactive (prototype, live page) — analyses it, and emits Web Everything standard-compliant code**: declarative components, blocks, intents, and the right adapter form, not a framework dump.

 The non-negotiable constraint is that it **must not depend on a single AI tool**. Model/vision/codegen is the fastest-moving part of this space, so the tool treats the AI as a *swappable provider behind a registry* — the "inject a provider" shape we use for [render strategies](/protocols/) and the MaaS compiler seam (#081). The AI is infrastructure you plug in, not architecture you bake in.

> **Re-sized 13 → 3 + de-staled (2026-06-15, `/split 086`).** The earlier "splittable but deferred"
> framing assumed the analyzer↔generator engine + neutral schema were unbuilt WE work. **They are not:**
> the whole pipeline — analyzer registry → neutral `ComponentIR` → verify-gated generation — **already
> shipped via sibling [#094](/backlog/094-ai-upgrader-tools/)** at
> `we:blocks/renderers/upgrader/upgraderEngine.ts` (for the inverse, legacy-code → standard direction). The
> neutral-schema decision this item calls "the hard, lasting design work" is **resolved in that code**
> (`we:upgraderEngine.ts:36` — *"#086 open decision, resolved"*), and the **vision** analyzer is a
> **Plateau-served service per [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/)**,
> not WE work. So #086's residual WE scope is narrow and single-slice (below) — re-sized to a directly
> batchable `story·3`; nothing to split.

## Progress (2026-06-15, batch-2026-06-15) — mockup input adapter landed on the #094 pipeline

The narrow WE-resident residual (below) is built — **one more input adapter on the #094 engine, no
parallel engine, no parallel generator:**

- **`SourceInput` extended** ([we:upgraderEngine.ts](../blocks/renderers/upgrader/upgraderEngine.ts)) with an
  optional `mockup?: MockupSource` ({ kind: image|figma|prototype, ref, description? }); `code` is now
  optional (mockup-only inputs carry no code). The existing code analyzers got a one-line `input.code != null`
  routing guard each — clean, `tsc --noEmit` green repo-wide.
- **Mockup analyzer + the no-leakage vision seam**
  [`we:analyzers/mockupAnalyzer.ts`](../blocks/renderers/upgrader/analyzers/mockupAnalyzer.ts): `mockupAnalyzer(provider)`
  routes on the `mockup` payload and lifts it to the **existing `ComponentIR`** via a swappable
  **`CustomVisionProvider`** — the same `customVisionProvider` seam #475/#396 share. Ships three providers:
  `createReferenceVisionProvider()` (deterministic, keyless **stand-in until the Plateau vision service ships**),
  `createPlateauVisionProvider({ endpoint })` (the thin **no-leakage Plateau-service client**, validates the
  returned IR before the engine trusts it), and a scripted provider for tests. `registerMockupAnalyzer()`
  mirrors `registerReferenceAnalyzers` (provider injected, no global singleton — devtools discipline).
- **Generation + verify gate reused as-is.** The IR lowers through `generateComponentSource` and is gated by the
  unchanged `verifyUpgrade` (parse + fidelity round-trip + intent conformance) — a hallucinating provider is
  never `offered`.
- **Unit tests** [`we:upgrader-mockup.test.ts`](../blocks/__tests__/unit/renderers/upgrader-mockup.test.ts) (5
  green): mockup → IR → generated → **offered**; routes without a language hint; omits an unknown intent
  ("flag, don't fake"); the verify gate refuses a hallucinated intent; a provider error is a diagnostic, never
  an exception. No regression across the existing upgrader suites (64 green).
- **Demo** [`we:demos/mockup-to-standard-demo.html`](../demos/mockup-to-standard-demo.html) + `.ts` (registered in
  we:demos.json): four mockup cards run **mockup → IR → generated `<component>` → verify badge → live custom
  element**. Browser-verified green on :3000 (4/4 cards, 4 verify-OK, live elements mounted, no console errors).

**Placement honored (#475 no-leakage):** the vision *impl capability* stays a Plateau-served service the tool
consumes as a client; only the neutral `ComponentIR` contract + the verified standard-conformant output are WE
artifacts. Interactive-mockup observed-state analysis (the strictly-larger problem) remains a later input-kind
addition behind the same provider seam — added, never migrated to.

## What's left (the actual WE-resident work)

The engine, registry, generator, and verify gate are reused as-is from #094. #086 adds a **mockup input
adapter** to that existing pipeline:

1. **Extend `SourceInput`** (`we:blocks/renderers/upgrader/upgraderEngine.ts`) to admit a **mockup** input
   kind (static image / Figma / interactive prototype) alongside the existing `code`/`language` shape —
   one more `handles()`-routed branch on the existing `CustomAnalyzerRegistry`, *not* a new registry.
2. **Register a mockup analyzer** that emits the **existing `ComponentIR`** — implemented as a **thin
   no-leakage client over the Plateau vision service** (#475), the same `customVisionProvider` seam #475
   /#396 share. A deterministic reference path can stand in until that service exists.
3. **A mockup demo** proving mockup → `ComponentIR` → generated `<component>` → verify gate, reusing the
   shipped generator (no parallel generator — #094's lowers to the exact `<component>` MaaS `serve()`
   consumes).

## The two requirements, stated sharply

| Requirement | What it means | Why it's the whole point |
|---|---|---|
| **AI-tool independence** | Mockup analysis (vision → structure) and code generation are **registry-backed providers** with a stable contract; any model/tool that meets the contract drops in. No provider name appears in the core. | This space turns over monthly. A tool wired to one vendor's API is obsolete on their next deprecation. Swappability is survival, not polish. |
| **Ongoing upgrade by construction** | New providers, better prompts, new mockup *input* kinds (static → interactive), and new *output* forms (a new adapter/render-strategy) are **added, never migrated to** — the contract is the only fixed point. | Treat "the frontier moved" as the expected steady state. The architecture should make adopting a better analyzer a config change, not a rewrite. |

## Two seams — and they are independent

The pipeline splits into two registry-backed stages so each evolves on its own clock:

1. **Mockup analyzer** (`customMockupAnalyzerRegistry`): mockup → a **neutral structural description** (a tree of intents/regions/roles/states), *not* code. A static image and an interactive prototype are different *input adapters* feeding the same neutral output. Interactive mockups additionally yield observed behavior/state transitions a static image can't.
2. **Code generator** (reuse the existing `webadapters` core + render-strategy registry, #052/#077/#078): neutral structure → standard-compliant code in the requested **form** (declarative `<component>`, WC class, JSX, …). This is *already built* — the tool should **not** grow a parallel generator; it feeds the neutral structure into the same single AST core MaaS (#081) and the [/adapters/](/adapters/) demos use, so output is provably the same transform we document.

The neutral structural description is the **contract between the seams**: it's what makes the AI swappable (analyzers compete to produce it well) and what keeps generation deterministic and standards-bound (generation never sees the model, only the structure).

## Why standard-compliant output, not "a React component"

Most design-to-code tools emit framework code and stop. The value here is that output lands as **Web Everything entities** — declarative components, the right intents wired in, accessibility/semantics from the standard rather than guessed — and can then be served/transformed in any form via the existing adapters and MaaS. The mockup tool is a *front door* onto the standard, not a competing codegen island. **Native-first:** generated code defaults to plain platform/WC output; a framework form is one adapter selection downstream, not the assumed target.

## Design decisions — all resolved or placed (no open forks)

These were "recommended" when authored; the #094 engine and the #475 placement have since **settled
every one**, which is why the size dropped:

- **Provider contract granularity** → **resolved in code.** The analyzer↔generator split is built; the analyzer is a registry-backed provider, generation reuses the shipped core (`we:upgraderEngine.ts`).
- **Neutral structure schema** → **resolved in code.** Expressed in the standard's own `<component>` vocabulary as `ComponentIR` (`we:upgraderEngine.ts:36` flags this as the resolved #086 decision) — not a bespoke IR.
- **Static vs. interactive as input adapters** → **seam built.** `SourceInput` + `handles()` routing already models input kinds behind one registry; the mockup kind is one more branch (see "What's left").
- **Quality gate** → **built.** The `offered: false` round-trip/conformance verify gate is the shipped moat.
- **Human-in-the-loop** → **placed by #475.** The neutral structure as the editable review surface is the #475 ruling (shared `customVisionProvider` review surface).

## Dependencies / sequencing

1. **`webadapters` AST core + render-strategy registry** (#052/#077/#078/#081) — the generation half already exists; the tool consumes it, doesn't rebuild it.
2. ~~**Neutral structural-description schema**~~ — **DONE** (#094, `ComponentIR`); reused, not re-authored.
3. ~~**Analyzer provider registry** + a first reference provider~~ — **DONE** (#094, `CustomAnalyzerRegistry` + reference/model analyzers); #086 adds a mockup analyzer to it.
4. **Static input first, interactive second** — interactive analysis (observing state transitions) is a strictly larger problem; land the static-mockup → `ComponentIR` → code path before it.

## Relationship to existing work

- **#081 Module-as-a-Service** — MaaS serves one component in N forms at request time. This tool *produces* the component (from a mockup) that MaaS then serves; shared `webadapters` core is the no-drift guarantee for both.
- **Render-strategy Protocol** (#052/#077/#078) — supplies the output-form/strategy axis the generator targets.
- **Provider-registry pattern** — same inject-a-provider shape as `CustomRenderStrategyRegistry` / `CustomCompilerRegistry`; this item is that pattern applied to the AI analysis + codegen frontier.

## Monetization note

A strong **tier-1 self-run product** under the solo-founder lens (see
[#089](/backlog/089-monetization-product-ideas/)): it runs on the customer's
dev/CI with **bring-your-own AI key**, so there's no model-hosting cost or uptime
obligation on us. White-space vs. incumbents (v0 / Builder.io / Locofy): those
emit *plausible framework code*; this emits **verifiably standard-conformant**
output gated by `check:standards`. Paired with the AI **upgrader tools**
([#094](/backlog/094-ai-upgrader-tools/)), which apply the same swappable-AI shape
to *existing* code.

**Placement (no-leakage, per [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/)):** the AI/vision
*impl capability* (the analyzer + generator behind the registry) is a **Plateau-served service the
tool consumes as a no-leakage client** — never WE-resident architecture. Only the **neutral-structure
contract** and the **generated standard-conformant output** are WE artifacts. The swappable-provider
shape is correct; this just names *where* the capability lives (BYO-key is a tier, not the floor).
