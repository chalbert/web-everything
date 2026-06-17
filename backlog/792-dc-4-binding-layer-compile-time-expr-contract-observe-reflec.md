---
type: decision
workItem: story
size: 3
parent: "076"
status: resolved
preparedDate: "2026-06-16"
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: backlog/825-observe-attribute-reflection-compile-time-lowering-dc-4-b1-u.md
relatedReport: reports/2026-06-16-binding-layer-platform-status-and-prior-art.md
tags: [webcomponents, component, declarative, binding, observe, template-instantiation, dom-parts, decision]
---

# DC-4 binding layer — compile-time expr contract (observe= reflection) now vs wait for Template Instantiation/DOM Parts

Keystone design call gating the design-blocked remainder of #076. The platform binding primitives
(Template Instantiation, DOM Parts, TC39 Signals) are all unshipped, contested, and re-forked into a new
JS-templating proposal (Dec 2025), so wait-for-platform is *defer-indefinitely*. But WE already lowers
`<component>` to a generated class at build time, so attribute-reflection bindings are buildable today as
generated imperative code (the Svelte model) with **zero platform bet**. The crux is wait (A) vs define a
minimal compile-time `{{expr}}` contract now (B, recommended). Full platform-status + prior-art survey in
the [related report](../reports/2026-06-16-binding-layer-platform-status-and-prior-art.md).

## Why now / why this is the keystone

Of #076's design-blocked remainder, **DC-4 gates the most** — `observe=` (observed-attribute → template
reflection) and reactive bindings both wait on it. The card's stated dependency ("unshipped Template
Instantiation / DOM Parts") is, on inspection, a dependency on a moving multi-year target that no browser
ships (see report §1). Meanwhile the high-value, low-complexity piece (`observe=` one-way reflection) is
**buildable today** via the existing build-time lowering. So this decision is worth making, not deferring.

## The fork

> Per WE's fork rules: a fork decides the *best end-state* on merit; cost/uncertainty is prioritization,
> not a branch. Option C is listed only to be rejected on that ground.

- **A — Wait for Template Instantiation / DOM Parts to ship.** Zero risk of WE inventing a contract the
  platform later contradicts; perfectly native. **But** nothing ships and the spec just re-forked (#1069,
  Dec 2025) — this is "defer indefinitely," leaving a buildable, high-value capability blocked. Not a
  better end-state, a *non*-end-state. **Rejected as the recommendation.**

- **B — Define WE's own minimal declarative binding contract now, lowered at compile time.** ✅ **BOLD DEFAULT.**
  - **B1 (ship first): `observe=` attribute reflection.** `observe="label count"` declares observed
    attributes; `{{label}}` in the template lowers to `static observedAttributes` + `attributeChangedCallback`
    + a generated per-hole updater (`node.textContent = this.getAttribute('label')`). One-way,
    attribute→content only. No reactive engine, no runtime interpreter — pure generated imperative code,
    the same paradigm as the existing lowering and Svelte.
  - **B2 (later, separately prioritized): richer reactive bindings** (computed, two-way, list) compose with
    `<for-each>` / a restricted "Web Expressions" sublanguage. Out of *this* decision's scope.
  - *Why safe vs A's fear:* the contract is a *source spelling* that lowers to plain DOM code — it bets on
    no single platform primitive. If DOM Parts ever ships, the lowering target swaps underneath; the
    authored `{{label}}` is unchanged. We adopt the mustache `{{ }}` the proposals use for *ergonomic +
    migration* reasons, **not** as a guarantee of forward-compatibility. The escape hatch — not the spelling —
    is the real safety: the lowering output *is* the eject (a plain, framework-free custom-element class —
    see `generateClassSource`), so a codebase full of `{{ }}` is always de-sugarable to vanilla, satisfying
    minimize-lock-in. Honest about cost: each `observe`d attribute emits `static observedAttributes` +
    `attributeChangedCallback` that dispatch *per mutation at runtime* — the Svelte tradeoff (cheap, generated,
    no interpreter — but not literally zero-runtime).
  - *Block-form collision scoped OUT, deliberately:* DOM Parts declarative uses `{{ }}` for scalar holes **and
    `{{#}}…{{/}}` for block/list constructs**. B1 ships the **scalar hole only**; any block/list spelling
    (`<for-each>` integration, conditionals) is **B2** and is where a genuine platform-contradiction risk
    lives. WE explicitly **reserves the right to diverge** from the DOM-Parts block grammar rather than
    pre-betting on an exploratory PR — the scalar-hole spelling-match buys ergonomics, it does not commit WE
    to the platform's block syntax. Deciding the block form is *not* in this card.

- **C — Keep bindings out of scope; ship only the non-binding remainder.** Minimal commitment, but `observe=`
  is buildable today and genuinely high-value; declaring it out-of-scope discards deliverable capability for
  a *prioritization* reason, not an end-state one. **Rejected** (per the fork-vs-prioritization rule).

## Sub-decisions to ratify (open points, defaults in bold)

1. **`{{expr}}` grammar** — **restricted expression sublanguage** (Angular/Vue model: no arbitrary JS, no
   assignments — sandboxable, statically lowerable, no impl leakage) *vs* raw JS in `{{ }}` (lit model).
2. **Binding direction default** — **one-way** (`{{ }}` reflect-only at B1) *vs* two-way; two-way is a
   later opt-in (Polymer `[[ ]]`/`{{ }}` split is the legible precedent).
3. **`observe=` spelling** — the attribute name + token form that declares observed attributes (ratify the
   exact spelling; `observe="a b"` is the working proposal).
4. **Execution model** — **compile-time lowering only, never browser-interpreted** (consistent with the
   `<component>` "not a browser-side interpreter" stance) *vs* a runtime directive interpreter (rejected:
   htmx/Alpine ergonomics at the cost of a shipped interpreter).

## Scope / out-of-scope

- **In:** the DC-4 contract above, ratified; B1 (`observe=` reflection) is the first build it unblocks.
- **Out (downstream/independent, tracked under #076):** B2 reactive/two-way/list bindings (downstream);
  DC-5 `behavior`/`extends` hook, scoped registration, manual slot assignment, shared stylesheets
  (independent — each its own design call). See report §4.

## Concrete code refs

- [declarativeComponent.ts](../blocks/renderers/component/declarativeComponent.ts) — `generateClassSource`,
  the existing build-time lowering Option B extends (emitting `static observedAttributes` /
  `attributeChangedCallback` is a localized addition).
- [#076](/backlog/076-component-declarative-wc-apis/) lines 34, 37–38 — the DC-4 block framing this resolves.
- [component.njk](../src/_includes/block-descriptions/component.njk) — Feature-Inventory row + Composition note tying DC-4 to `<for-each>`.

## ⚠ Premise hole — re-grounding needed before ratification (2026-06-17)

A grounding pass during the decision turn found that **WE already ships a `{{expr}}` binding layer** the
prepared item and its report missed entirely. The `webexpressions` plug family is `status: active` (ratified
contracts) in `src/_data/plugs.json`:

- `CustomTextNodeRegistry` / `CustomTextNodeParser` / `CustomTextNodeParserRegistry` /
  `CustomExpressionParserRegistry` — the parse→evaluate pipeline (contracts in plugs.json; runtime impl
  vendored in `plugs/webexpressions/`, FUI-owned pending #170).
- `blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser.ts` (`{{ }}`) **and**
  `…/double-square/DoubleSquareBracketParser.ts` (`[[ ]]`) — the Polymer one-way/two-way spelling split is
  *already implemented*, not merely "prior art to borrow" (report §2 is wrong on this).
- `blocks/text-nodes/interpolation/InterpolationTextNode.ts` — a **runtime expression interpreter**
  (parses + evaluates on `connectedCallback` via the injector-resolved `CustomExpressionParserRegistry`).
  "Phase 1 limitation: evaluates once on connect, no reactive auto-update."

**Impact on the fork as written:**
- **Sub-decision 4 ("compile-time lowering only, *never browser-interpreted*") is contradicted by a shipped,
  `status: active` interpreter.** WE cannot ratify "never interpreted" while shipping `InterpolationTextNode`.
  The real question is the *relationship* between the existing **plugged/runtime** interpreter and a new
  **unplugged/build-time** `<component>` lowering — likely the plugged-vs-unplugged duality, not "interp vs not."
- **Sub-decisions 1 & 3 are partly pre-built** — `CustomExpressionParser` is the restricted-sublanguage seam;
  the `{{ }}`/`[[ ]]` spellings already exist. DC-4 should likely *reuse* `CustomExpressionParserRegistry` as
  its expression contract rather than define a parallel one.
- The B1 capability (`observe=` attribute→content reflection) is still buildable and still the right first
  slice — but it is a **compile-time projection of an existing binding contract**, not a greenfield invention.

The premise correction below reframes the fork; the ruling that follows is ratified against the *corrected*
premise, not the greenfield one.

## Ruling (2026-06-17, ratified against corrected premise)

**Ratified: B, reframed as the unplugged twin of `webexpressions`.** WE builds the `<component>` declarative
binding now (rejecting A/C as before — defer-indefinitely / discards-buildable-value). But it is **not a
greenfield contract**: it is the **compile-time / unplugged realization of the already-ratified
`webexpressions` runtime binding layer.** B1 (`observe=` attribute→content reflection) is the first slice.
*(~80%; residual is the parser-contract reuse seam below — a build detail, not a fork.)*

**The plugged/unplugged split (this is the spine of the reframe):**
- **Plugged / runtime path — already shipped:** `webexpressions` parses `{{ }}`/`[[ ]]` in live DOM and
  evaluates via `CustomExpressionParserRegistry` resolved off the injector chain (`InterpolationTextNode`).
- **Unplugged / build-time path — what DC-4 adds:** the `<component>` adapter lowers the *same authored
  spelling* to `static observedAttributes` + `attributeChangedCallback` + generated updaters — no injector
  chain, no runtime registry lookup, tree-shaken.
- **Reuse seam (precise):** DC-4 reuses the **expression *grammar / parser contract*** (`CustomExpressionParser`
  — the restricted sublanguage), **not** the runtime *registry resolution* (`InjectorRoot.getProviderOf` has no
  build-time analogue). Same source spelling + same grammar, two evaluation backends. This *is* the split.

**Sub-decisions, re-ruled against the corrected premise:**
1. **Restricted expression sublanguage — reuse `CustomExpressionParser`, do not define a parallel grammar.**
   (Was "define one"; corrected to "adopt the shipped one.") *(~85%.)*
2. **One-way default, two-way later opt-in** — unchanged; `[[ ]]`/`{{ }}` split already exists to express it. *(~90%.)*
3. **`observe="a b"` spelling** — unchanged (the build-time declaration of observed attributes; orthogonal to
   the shipped text-node spellings). *(~80%.)*
4. **REPLACED.** ~~"never browser-interpreted"~~ is false — WE ships an interpreter. New ruling:
   **the `<component>` path lowers at compile time (unplugged); the runtime interpreter remains the plugged
   path; the two are twins over one grammar, not rivals.** *(~85%.)*

**Red-team trail:** the skeptic sub-agent confirmed B as the end-state (impl-boundary + most-flexible-default
attacks failed) and forced two amendments (eject-guarantee over false forward-compat claim; block-form scoped
out). The user's grounding push then caught the larger hole — the shipped `webexpressions` layer — which
collapsed sub-decision 4 and reframed B from greenfield to unplugged-twin. (Lesson: a prepared decision's
report must be traced to the real tree before ratifying — the report's "prior art to borrow" was already built.)

**Layer placement:** the *contract* (`observe=` + the shared `{{ }}` grammar + the lowering guarantee) is WE's
(`component.njk` + the `webexpressions`/component block spec). The *lowering impl* (`generateClassSource`
emitting `observedAttributes`/`attributeChangedCallback`) and the *runtime interpreter* are FUI-owned. The B1
build slice is filed as its own item under #076.
