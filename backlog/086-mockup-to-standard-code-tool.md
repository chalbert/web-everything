---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [design-to-code, mockup, ai-agnostic, provider-registry, codegen, standard-compliance, adapters, native-first, swappable-provider]
relatedProject: webadapters
crossRef: { url: /adapters/, label: Rendering Adapters }
---

# Mockup-to-standard-code tool — analyse a UI mockup, emit standard-compliant code, never married to one AI

A tool that **ingests a UI mockup — static (image, Figma/Sketch export, screenshot) or interactive (a clickable prototype, a live page, a recorded flow) — analyses it, and emits Web Everything standard-compliant code**: declarative components, blocks, intents, and the right adapter form, rather than a one-off framework dump. The non-negotiable design constraint is that it **must not depend on a single AI tool**. Model/vision/codegen capability is the fastest-moving part of this space, so the tool treats the AI as a *swappable provider behind a registry* — the same "don't reinvent the wheel, inject a provider" shape we already use for [render strategies](/protocols/) (`CustomRenderStrategyRegistry`) and the MaaS compiler seam (`CustomCompilerRegistry`, #081). The AI is infrastructure you plug in, not architecture you bake in.

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

## Open decisions (recommendations in bold)

- **Provider contract granularity.** **Two registries (analyzer + generator), not one monolith** — they move at different speeds and a single image-model upgrade shouldn't touch generation. Mirrors keeping JSX-spelling separate from reactivity-strategy.
- **Neutral structure schema.** **Express it in the standard's own vocabulary — intents/regions/roles/states — not a bespoke IR.** Borrow platform/standard terms (ARIA roles, intent names) so the contract is reviewable and stable, and so generation is a lookup, not a translation guess.
- **Static vs. interactive as input adapters.** **Model both as analyzer *input kinds* behind one registry**, where interactive analyzers additionally emit observed state/behavior. Don't fork the pipeline; widen the analyzer contract.
- **Quality gate.** **Round-trip / conformance check the generated code** (it must register, render, and pass `check:standards`) before it's offered — and ideally diff the rendered result back against the mockup. A generator is only trustworthy if its output is verified, not just produced.
- **Human-in-the-loop.** **Treat the neutral structure as the editable review surface** — a person corrects structure once, and every downstream form regenerates from it. Don't make people hand-fix emitted code per form.

## Dependencies / sequencing

1. **`webadapters` AST core + render-strategy registry** (#052/#077/#078/#081) — the generation half already exists; the tool consumes it, doesn't rebuild it.
2. **Neutral structural-description schema** — the new contract; the hard, lasting design work.
3. **Analyzer provider registry** + a first reference provider (any current vision model) proving the swap point is real.
4. **Static input first, interactive second** — interactive analysis (observing state transitions) is a strictly larger problem; land the static→neutral→code path before it.

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
