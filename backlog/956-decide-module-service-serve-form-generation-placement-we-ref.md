---
type: decision
workItem: story
size: 2
status: resolved
locus: webeverything
relatedProject: webdocs
relatedReport: reports/2026-06-18-module-service-serve-placement.md
parent: "081"
blockedBy: []
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-18"
tags: [maas, module-service, boundary, placement, codegen]
---

# Decide module-service / serve() form-generation placement — WE reference-runtime keeper vs FUI codegen impl (apply #791 rule + reconcile #855)

> **Prepared 2026-06-18** ([report](../reports/2026-06-18-module-service-serve-placement.md)). The
> prior-art is prior rulings (#791 partition · #855/#892 codegen→FUI · #707 boundary) — no new `/research/`
> topic (*Why no research topic* in the report; same posture as #791/#855). **Grounding reshaped the
> fork:** the item's original bold default (move the generators to FUI) is **broken** once traced to the
> tree, so this is a **forced-invariant ratify**, not a genuine A/B. The genuine choice it appeared to
> contain (how FUI *consumes* the output) already lives in **#954**, which this unblocks.

## Grounding digest (the finding that reshapes the call)

The fork was framed as *"do `serve()`'s form-generators live in WE or FUI?"* with **move-to-FUI** as the
bold default. Traced to the real tree, that branch does not survive:

- **The generators are not in `module-service/`, and `serve()` owns no transform logic** — its header says
  it "owns NO transform logic of its own — it only resolves + dispatches." It dispatches to three modules
  in **sibling renderer dirs**: `generateClassSource`
  ([`we:blocks/renderers/component/declarativeComponent.ts:152`](../blocks/renderers/component/declarativeComponent.ts#L152)),
  `htmlToJsx` ([`we:blocks/renderers/jsx/htmlToJsx.ts:195`](../blocks/renderers/jsx/htmlToJsx.ts#L195)),
  `generateFunctionalSource` ([`we:blocks/renderers/functional/functionalComponent.ts:41`](../blocks/renderers/functional/functionalComponent.ts#L41)).
- **They have multiple WE-side consumers besides `serve()`:** `htmlToJsx` is the core of `renderers/jsx`
  (the JSX renderer + render-strategy infra — 6 files incl. `we:blocks/renderers/jsx/index.ts`,
  `we:blocks/renderers/jsx/directives.ts`, `we:blocks/renderers/jsx/render-strategy/crossStrategy.ts`) —
  which **#791 already names a "concrete keeper today"**; `generateClassSource` feeds the
  standard-exercising **demo** (`we:demos/component-adapter-demo.ts:83`).
  Separately, the *module* `we:blocks/renderers/component/declarativeComponent.ts` is consumed by the
  **upgrader** — via its `parseDefinition` parser + `ShadowMode` type
  (`we:blocks/renderers/upgrader/upgraderEngine.ts:31`,
  `we:blocks/renderers/upgrader/analyzers/versionMigration.ts:23`,
  `we:blocks/renderers/upgrader/analyzers/legacyWebComponent.ts:17`), **not** `generateClassSource` itself
  (grounding correction 2026-06-18) — so the *file* can't relocate to FUI under #707 regardless of where the
  generator alone went.
- **`@webeverything` doesn't publish them** (package is `web-everything`; the renderers are repo-internal
  reference runtime, not a published codegen API). Verified at ratify: no `we:blocks/package.json` and no
  `@webeverything/*` `exports` map reaches `we:blocks/renderers/*`.

So relocating them to FUI would **reverse #791's ratified `renderers/jsx` keeper** and **strand the
upgrader + demos**, which under **#707** may not re-import from FUI. The "move to FUI" branch is broken.

## The axis (where it actually decomposes)

The title's real question — *reconcile #791 with #855* — resolves because the two rules govern
**different axes**, not the same one:

- **#791 → repo-residence:** which *code* lives in the WE repo. Reference runtime of a WE standard stays.
  The renderers are the reference runtime of the `<component>` + jsx-adapter standards
  ([`we:blocks/renderers/module-service/moduleService.ts:142`](../blocks/renderers/module-service/moduleService.ts#L142) is their serve-time
  dispatcher), with live WE consumers → **stay WE**.
- **#855 → the published standard:** what ships as `@webeverything`. Only contracts/protocols/conformance;
  never framework codegen. So `@webeverything` publishes the `<component>` contract + the `ServeForm`
  contract ([`we:blocks/renderers/module-service/moduleService.ts:33`](../blocks/renderers/module-service/moduleService.ts#L33)) + behavioral
  vectors — **the lowering code is never a shipped standard**.

Both hold at once: **generators stay in the WE repo as reference runtime (#791); `@webeverything` publishes
only the contract + vectors (#855).** #855's `genWrapper` *moved* only because it had **zero WE consumers**
(it existed solely to feed the FUI panel); the renderers are the opposite — WE already runs them and already
produces this output, so there is nothing to move.

`serve()` itself is likewise a keeper: it exercises the **MaaS** standard (the serve-time twin of the
build-time adapters), and its `module-service/` peers — `fetchHandler` (#461), `servePathIR` (#505),
`productionDelivery` (#312) — are already ratified reference-runtime keepers.

### Recommended path at a glance

| Concern | Recommended (ratify) | Excluded branch | Confidence |
|---|---|---|---|
| Where the form-generators live | **WE repo as reference runtime (#791); `@webeverything` ships only the `<component>`/`ServeForm` contract + conformance vectors (#855)** | *Move the generators to FUI* — broken (reverses #791's `renderers/jsx` keeper; strands the upgrader + demos under #707) | High (~85%) |
| How the FUI panel obtains the source | **→ delegated to [#954](/backlog/954-decide-how-polyglot-author-mode-source-reaches-the-fui-workb/)** (data-emit vs FUI-port), which this unblocks | — | (#954's call) |

## RATIFIED 2026-06-18

**Ruling:** the form-generators (`generateClassSource`, `htmlToJsx`, `generateFunctionalSource`) and the
`serve()` dispatcher **stay in the WE repo as reference runtime (#791)**; `@webeverything` publishes only the
`<component>` definition contract, the `ServeForm` contract, and the behavioral conformance vectors — **never
the lowering code (#855)**. #791 (repo-residence) and #855 (published-standard) are different axes, not in
tension. Confidence **high (~85%)**.

**Red-team (skeptic sub-agent, prompted only to refute):** verdict **RULING HOLDS (~80%)**. It independently
confirmed (a) the genWrapper-vs-these distinction is real in the tree — `genWrapper` has zero WE consumers,
these have multiple live ones; the drawable line is *"does a WE-side consumer execute it?"* (= #855's own
holding); (b) the published-leak attack fails — no `we:blocks/package.json`, no `@webeverything/*` re-exports the
generators, root pkg is unscoped `web-everything`; (c) the "move to FUI" branch genuinely contradicts #791 +
#707. The "these *are* codegen" attack is answered by the two-axis split. **Two hardening residuals (not
refutations)** were carved to a follow-up build (#964): (1) the "WE-side consumer executes it" line leans on
*demos*, so a future framework emitter could ship a demo to manufacture a consumer — #956's per-form
refinement is the guard but is guidance, not a gate; (2) "renderers never enter a published `exports` map" is
true today by absence, not by an enforced `check:standards` rule. #964 elevates both to gates.

**graduatedTo:** none — confirms existing rules (#791 + #855) and unblocks #954; creates no new entity.

## Ratify (forced invariant — not a genuine A/B)

**Fork-existence:** this is case (a) — exactly one branch is correct and the alternative is *broken*. The
excluded branch is *"the generators move to FUI"*: it reverses #791's already-ratified `renderers/jsx`
keeper and strands WE-side consumers (upgrader, standard-exercising demos, the jsx render-strategy infra)
that #707 forbids re-importing from FUI. There is no coherent either/or in #956 itself — the genuine choice
is downstream in #954.

**Recommended ruling to ratify (high, ~85%):** the form-generators (`generateClassSource`, `htmlToJsx`,
`generateFunctionalSource`) and the `serve()` dispatcher **stay in the WE repo as reference runtime**
(#791); `@webeverything` publishes only the `<component>` definition contract, the `ServeForm` contract,
and the behavioral conformance vectors — **never the lowering code** (#855). This reconciles #791 and #855
(different axes: repo-residence vs published-standard) and confirms — rather than dissolves —
[#954](/backlog/954-decide-how-polyglot-author-mode-source-reaches-the-fui-workb/)'s data-emit default.

**Principled refinement (apply #791 per form):**
- A form **WE's reference runtime already emits** (`declarative | wc-class | html | jsx | functional`) →
  stays WE; its output crosses to FUI as data (#954-A).
- A genuinely-**new framework target with no WE reference runtime** (Vue/Svelte/Angular — #818's deferred
  slices, #939's emit-IR) → the #855/`genWrapper` pattern applies: WE ships contract + vectors, the
  FUI-side generator derives it. *Out of scope here; it is #818/#939/#954's call when those targets exist.*

**Residual / red-team flag for the decider (~15%):** the one principled attack is "these *are* codegen, and
#855 says codegen isn't a `@webeverything` standard." That attack is answered by the two-axis split — the
generators stay in the WE *repo* as reference runtime without being a *published* `@webeverything` codegen
standard; #791 (repo-residence) and #855 (published-standard) are not in tension. The decider's skeptic
should test that split directly: if "reference runtime in the repo" is judged to still leak codegen as a de
facto standard, the per-form refinement is where the line moves, not the residence call.

## Consequence for #954 (what this unblocks)

[#954](/backlog/954-decide-how-polyglot-author-mode-source-reaches-the-fui-workb/) (`blockedBy: 956`) asks
how the FUI panel consumes WE-side artifacts. With the generators settled WE-side behind #707, the panel
**cannot call them directly**, so #954's genuine fork stands: **data-emit (#954-A)** vs **FUI
ports/duplicates (#954-B)**. #956 strengthens #954-A — re-deriving in FUI would duplicate lowering WE
already computes, with no swappability gain (it is the *same* native source WE's reference runtime emits,
not a new framework target). Settling #956 lets #954 proceed; #818's source-form half then rides #954's
chosen mechanism.

---

## Context

**Lineage:** #081 (MaaS parent) · #791 (reference-vs-impl partition; `renderers/jsx` named a keeper) ·
#855/#892 (codegen is not a `@webeverything` standard; `genWrapper`→FUI) · #707 (WE never imports/renders
FUI code) · #461/#505/#312 (the `module-service/` MaaS-origin keepers) · #954 (downstream consumption fork,
unblocked by this) · #818/#939 (deferred per-framework emitters / emit-IR).

**Reports:** this item's [reconciliation report](../reports/2026-06-18-module-service-serve-placement.md);
the external codegen-placement survey reused from #855's
[report](../reports/2026-06-17-we-fui-wrapper-handoff.md) / [research topic](/research/we-fui-wrapper-handoff/);
#791's [boundary reconciliation report](../reports/2026-06-16-we-demos-blocks-deletion-boundary-reconciliation.md).

**Codified rule it leans on:** the WE↔FUI embed boundary, `we:docs/agent/platform-decisions.md#we-fui-embed-boundary`
(rule 4, reference-vs-impl partition; rule 6, website ≠ standard / source-dependency-direction test).
