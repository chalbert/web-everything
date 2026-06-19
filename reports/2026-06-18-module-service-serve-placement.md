# `serve()` form-generation placement — reconciling #791 (partition) with #855/#892 (codegen→FUI)

**Date:** 2026-06-18 · **Item:** [#956](/backlog/956-decide-module-service-serve-form-generation-placement-we-ref/) ·
**Blocks:** [#954](/backlog/954-decide-how-polyglot-author-mode-source-reaches-the-fui-workb/) ·
**Class:** ratify-existing-internal-ground (no new `/research/` topic — see *Why no research topic*).

## Why no research topic

This is a *constellation-reconciliation* decision, the same posture as [#791](/backlog/791-reconcile-658-697-delete-and-repoint-with-the-604-iframe-bou/)
and [#855](/backlog/855-decide-the-we-fui-wrapper-handoff-mechanism-for-the-polyglot/): the prior art is *prior
rulings*, not the external ecosystem. The external survey that the codegen-placement question needs was
already run for #855 — its [report](2026-06-17-we-fui-wrapper-handoff.md) / [research topic](/research/we-fui-wrapper-handoff/)
found framework codegen is a **build-time artifact of the source library, published for the consumer to
read** (Stencil output targets, Lit Labs `gen-wrapper-*`, `@lit/react`); **no shipping tool generates in
the consumer**. #791 established the **reference-vs-impl partition rule** (a block stays in WE iff its demo
exercises a WE standard). #956 only applies those two ratified rules to one mixed dir, so it skips the web
survey and does the concrete-refs check instead.

## The grounding correction that reshapes the fork

[#956](/backlog/956-decide-module-service-serve-form-generation-placement-we-ref/) (surfaced from #954)
framed a fork: do *"`serve()`'s form-generators"* live in WE (A) or move to FUI (B, bold default)? Tracing
the named symbols against the tree dissolves the "move to FUI" branch:

- **The form-generators do not live in `module-service/`.** `serve()`
  ([`we:blocks/renderers/module-service/moduleService.ts:142`](../blocks/renderers/module-service/moduleService.ts#L142)) **owns no transform
  logic** — its own header says so ("it owns NO transform logic of its own — it only resolves + dispatches
  to the existing SHARED transform modules"). It imports and dispatches to three modules that live in
  sibling renderer dirs:
  - `generateClassSource` — [`we:blocks/renderers/component/declarativeComponent.ts:152`](../blocks/renderers/component/declarativeComponent.ts#L152)
  - `htmlToJsx` — [`we:blocks/renderers/jsx/htmlToJsx.ts:195`](../blocks/renderers/jsx/htmlToJsx.ts#L195)
  - `generateFunctionalSource` — [`we:blocks/renderers/functional/functionalComponent.ts:41`](../blocks/renderers/functional/functionalComponent.ts#L41)
- **They have multiple WE-side consumers** (not just `serve()`):
  - `htmlToJsx` is the core of `renderers/jsx` — the JSX renderer + the render-strategy infra
    (`we:blocks/renderers/jsx/JSXRenderer.ts`, `we:blocks/renderers/jsx/render-strategy/CustomRenderStrategy.ts`, `we:blocks/renderers/jsx/index.ts`).
    **#791 explicitly names `renderers/jsx` (jsx-*) a "concrete keeper today."**
  - `generateClassSource` is consumed by the **upgrader** (`we:blocks/renderers/upgrader/upgraderEngine.ts` +
    analyzers) and by standard-exercising **demos** (`component-adapter-demo`, `module-as-a-service-demo`,
    `mockup-to-standard-demo`, `code-upgrader-demo`).
- **`@webeverything` does not publish them.** The package is `web-everything`; the renderers are
  repo-internal reference runtime + demo substrate, not a published codegen API.

So **literally relocating the generators to FUI is broken**: it reverses #791's already-ratified
`renderers/jsx` keeper, and it strands the upgrader + standard-exercising demos, which — under #707 — may
**not** re-import them from FUI (WE never imports FUI). The item's bold default (B) cannot be implemented as
written.

## The #791 ↔ #855 reconciliation (the title's actual question)

The two rules govern **different axes** and do not conflict:

- **#791 governs repo-residence:** which *code* lives in the WE repo. Reference runtime of a WE standard
  stays (the renderers are the reference runtime of the `<component>` + jsx-adapter standards, with WE
  consumers).
- **#855 governs the published standard:** what ships as `@webeverything`. Only contracts/protocols/
  conformance — never framework codegen. So `@webeverything` publishes the `<component>` definition contract
  + the `ServeForm` contract ([`we:blocks/renderers/module-service/moduleService.ts:33`](../blocks/renderers/module-service/moduleService.ts#L33))
  + behavioral conformance vectors; the lowering *code* is never a shipped standard.

Both are satisfied at once by: **generators stay in the WE repo as reference runtime (#791); `@webeverything`
publishes only the contract + vectors (#855).** #855's genWrapper *moved* only because it had **zero WE
consumers** — it existed solely to feed the FUI panel, so relocating lost WE nothing. The renderers are the
opposite: WE already runs them and already produces this exact output. There is nothing to move.

## Consequence for #954 (downstream)

Because the generators stay WE-side behind the #707 boundary, the FUI polyglot panel **cannot call them
directly**. So #956 *confirms* rather than dissolves [#954](/backlog/954-decide-how-polyglot-author-mode-source-reaches-the-fui-workb/)'s
genuine fork — **data-emit (#954-A)** vs **FUI ports/duplicates them (#954-B)** — and strengthens #954-A:
re-deriving in FUI (#954-B) would duplicate lowering WE already computes, with no swappability gain (it is
the *same* native source WE's reference runtime emits, not a new framework target). #956's job is only to
settle residence; #954 (which it blocks) owns the consumption mechanism.

## The principled refinement (per-form dividing line)

Apply #791's reference-vs-impl test **per form**:
- A form **WE's reference runtime already emits** (`declarative | wc-class | html | jsx | functional`) →
  stays WE; its output crosses to FUI as data (#954-A).
- A genuinely-**new framework target with no WE reference runtime** (Vue / Svelte / Angular — #818's
  deferred slices, #939's emit-IR) → the #855/genWrapper pattern applies: WE publishes the contract +
  vectors, the FUI-side generator derives it. There is no WE runtime to be the source of truth, so codegen
  is legitimately FUI/tool-side.

The dividing question is exactly #791's: *does a WE reference runtime already emit this form?*
