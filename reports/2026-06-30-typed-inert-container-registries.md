# Typed inert-container registries — prep research for #1986

**Decision:** [#1986](../backlog/1986-custom-type-registry-family-customtemplatetype-customscriptt.md) ·
mechanism-for [#1983](../backlog/1983-directive-form-standard-comment-vs-template-form-reconcile-t.md)
(directive *form* — resolved) · 2026-06-30 ·
research topic: [`typed-inert-container-registries`](../src/_data/researchTopics/typed-inert-container-registries.json) ·
builds on [2026-06-30 directive-authoring-forms](2026-06-30-directive-authoring-forms.md).

## Why this report exists

#1983 ratified the directive **form** — a typed `<template type="kind">` (inert) / `<!-- ns:name -->` (live),
**`is=`-free** — and explicitly **carved out the *registration mechanism* to #1986**
(`we:docs/agent/block-standard.md:397`). This report grounds #1986: *which registry implements the ratified
`type=` form*, whether it is one parameterized registry or three siblings, and whether a `<script type>`
sibling earns its place yet. The `type=` discriminator itself is **not re-litigated** — #1983 settled it.

## Ground truth (verified in `frontierui/`)

| Inert container | Discriminator | Registry today | Lifecycle source |
|---|---|---|---|
| `<!-- ns:name -->` | `ns:name` comment grammar | **`CustomCommentRegistry`** (built) | `define`/`upgrade`/`whenDefined`, eager upgrade-walk (`fui:plugs/webdirectives/CustomCommentRegistry.ts`) |
| `<template type="if">` | the `type` **value** | **none yet** — built `view:if` rides `CustomAttribute` on attribute *name* `view:if` | `fui:blocks/view/registerViewDirectives.ts:13-17` |
| `<script type="injector">` | native `type` value | **a bespoke boot-scan** — `applyDeclarativeInjectors` does `querySelectorAll('script[type="injector"]')`, idempotent | `fui:plugs/webinjectors/declarativeInjector.ts:107-147` |
| `<template is="portal-directive">` | `is=` customized built-in | `CustomTemplateDirective` (`extends HTMLTemplateElement`) | `fui:plugs/webdirectives/CustomTemplateDirective.ts:46-48`, registered `{extends:'template'}` `fui:plugs/webportals/index.ts:54` |

Two registries already exist as **concrete siblings on one shared base**: `CustomCommentRegistry` and
`CustomAttributeRegistry` both `extends HTMLRegistry` (`fui:plugs/core/HTMLRegistry.ts:21`). The base already
carries the common `define`/`get`/`getLocalNameOf`/bidirectional-name-map shape; each sibling adds only its own
`upgrade(root)` walk. So the "shared shape" of a `CustomTypeRegistry` **already exists** — as the base class, not
as a god-object.

**The `observedAttributes` capability is not `is=`-only.** `CustomAttributeRegistry` already provides
`observedAttributes` + `attributeChangedCallback` for *non-element* hosts via a `MutationObserver` it owns
(`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:84,99,207,425-427,526-576`). `portal` today gets attribute
reactivity *natively* from the customized built-in (`static observedAttributes = ['target','disabled','required']`,
`fui:plugs/webportals/PortalDirective.ts:123`); migrating it onto a `type=` registry replaces the native
callback with the same MutationObserver machinery `CustomAttribute` already ships. **So the migration loses no
capability** — the one feared regression is already a solved problem in-tree.

## Prior-art survey (full findings in the research topic)

- **F1 — `<script type>` is a native open kind-space.** The HTML spec defines unrecognized `type` values as
  **"data blocks… not processed by the user agent, but instead by author script or other tools"**
  (https://html.spec.whatwg.org/multipage/scripting.html). `CustomScriptType` rides a *genuine* native
  extension point; the browser already leaves the value inert for tools to interpret. Caveat: the spec
  recommends a **non-JS-MIME** string for data blocks, so a bare `type="injector"` is mildly off-guidance
  (`application/we-injector` vs `injector` — a #1987 naming question).
- **F2 — but native gives inertness, not a registry.** `HTMLScriptElement.supports()` is a **closed** set
  (`classic`/`module`/`importmap`/`speculationrules`); there is no native *open registration* over script
  types. The registry + `define`/`upgrade`/`whenDefined` lifecycle is a **WE invention over a native inert
  substrate**.
- **F3 — `<template type>` has no native precedent; `type` on `<template>` is unused (collision-safe).** Every
  standardized `<template>` attribute is a shadow-root **modifier** (`shadowrootmode`, `shadowrootclonable`, …),
  and `shadowrootmode` is explicitly a *mode* (adjectival), not an *is-a kind*
  (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template). `type` is undefined on
  `<template>`, so a WE convention won't clash with any standard attribute.
- **F4 — `type=`-as-is-a-kind is the platform's pervasive discriminator idiom** (`<input type>`, `<button type>`,
  `<ol type>`, `<script type>`), contrasted against adjectival `…mode`/boolean config attrs. `<template type="if">`
  ("this template *is* an if-block") is *in the grain* of native `type=` semantics. (Inferred from the
  cross-element pattern + the `shadowrootmode` contrast — no single "type means is-a" citation; **partly
  uncertain**.)
- **F5 — `is=` customized built-ins are vendor-rejected; the platform itself moved off them.** WebKit's
  standards-position is **"oppose"** (https://github.com/WebKit/standards-positions/issues/97); the active
  replacement is `ElementInternals.type` (https://github.com/whatwg/html/issues/11061) — *discriminate-on-the-
  element*, not a customized-built-in subclass. Replacing `is=` with `type=` follows where the standards bodies
  actually went.
- **F6 — native template-instantiation roadmap anticipates conditionals/loops + a processor seam.** Template
  Instantiation → DOM Parts; the March-2025 WG minutes note "standardization of looping, conditionals, plus
  customization" (https://www.w3.org/2025/03/26-webcomponents-minutes.html,
  https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md). So `<template
  type="if">` is a **forward-compatible bet in the platform's direction** — though the native proposals lean
  toward a **JS-passed processor**, not a `type` *attribute*, so the attribute-keyed part is a WE invention
  (**uncertain**).
- **F7 — a runtime registry keyed by an element discriminator is the dominant framework model.** Vue
  (`app.directive('highlight', …)`), Angular, Alpine all register/match directives at **runtime** by a
  name/discriminator on the element (https://vuejs.org/guide/reusability/custom-directives); Svelte is
  compile-time; Lit is a per-call factory. WE's `type`-keyed registry mirrors the dominant Vue/Angular/Alpine
  shape.
- **F8 — lifecycle parity target = `CustomElementRegistry`.** `define`/`upgrade`/`whenDefined` +
  `observedAttributes`/`attributeChangedCallback` (https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry).
  `upgrade` matters because inert containers, like un-upgraded custom elements, can exist in the DOM *before*
  the registry loads — the registration-vs-presence race the native API was designed for. Copying this surface
  verbatim is the right move.

## What this means for the decision

- **The `type=` form must register through a *value-space* registry — `CustomAttribute` cannot implement it.**
  `CustomAttribute` dispatches on attribute **name** (`view:if`); it matches that name *tree-wide*. The ratified
  form dispatches on the `type` attribute's **value** on `<template>`. To host `type=` in `CustomAttribute` you
  would register the attribute *name* `type` — matching every `<input type>`/`<script type>` in the tree — and
  re-implement value-dispatch inside it. So `CustomAttribute` is **unfit to express the ratified discriminator**:
  this makes the new value-space registry a *forced consequence* of #1983, not a fresh weigh.
- **The "shared shape" already exists as `HTMLRegistry`, so three concrete siblings ≠ duplication.** A single
  parameterized `CustomTypeRegistry` would *re-implement* what `HTMLRegistry` already is. Separate-and-decouple +
  the two shipped concrete siblings → **three siblings on the base** is the grounded default.
- **`CustomScriptType` → build now (the prep skeptic flipped this).** The first draft read "no built consumer →
  not-yet"; both halves are wrong. `<script type="injector">` *is* built — `applyDeclarativeInjectors` already
  runs an idempotent boot-scan (`fui:plugs/webinjectors/declarativeInjector.ts:107-147`) that **is** an
  `upgrade(root)` walk in all but name, so the registry can absorb it (no over-build) and delete the bespoke
  scanner. "No consumer yet" is a banned defer reason once the contract is codified
  (`we:docs/agent/backlog-workflow.md:521`), and the once-named trigger (#1968 landing as a `<script type>`
  annotation) is counterfactual — #1968 resolved **zero-node** (an event front door, not an annotation). Defer
  guarantees a second bespoke scanner for the next `<script type>` consumer.
- **Codifies into** `we:docs/agent/block-standard.md#directive-form` (the slot #1983 left at `:397`), composing
  with the `Custom[Name]Registry` naming convention (`we:docs/agent/platform-decisions.md:618-627`) and the
  registry name-validation scope rule (`we:docs/agent/platform-decisions.md:654-680`).

## Skeptic pass (folded into the item — two defaults flipped)

The prep skeptic (throwaway `general-purpose`, prompted only to refute) materially changed the prep — two
defaults flipped, which is the prep working as intended (the attack landed in prep, not at ratify):

- **"Register via a new registry, not `CustomAttribute`" — REFUTED *as a forced invariant* → demoted to a merit
  Fork.** Citation-scope: #1983 rule 5 files this exact question as *open* ("`CustomTemplateType` registry **vs**
  `CustomAttribute`", `we:docs/agent/block-standard.md:397`); rule 4 routes behaviors *into* `CustomAttribute`.
  Classification: `CustomAttribute` already value-sub-dispatches internally (the `-active`/`-when` suffix matcher,
  `fui:plugs/webbehaviors/CustomAttributeRegistry.ts:534-539`), so "structurally cannot dispatch on a value" is
  false. The default (mint `CustomTemplateTypeRegistry`) **held on merit** — semantic + perf + value-space
  clarity — but it is now argued, not asserted as forced.
- **Registry shape (three siblings vs one parameterized): SURVIVES** — the god-object re-implements
  `HTMLRegistry`'s role and re-branches the substrate divergence internally. Amendment folded: lift the
  copy-pasted `whenDefined` resolver-map into the base.
- **`CustomScriptType` now vs defer: REFUTED *the not-yet* → flipped to build-now.** A built consumer already
  exists (`fui:plugs/webinjectors/declarativeInjector.ts:107`); the once-named defer trigger is counterfactual
  (#1968 resolved zero-node); deferring collides with the codified "no-consumer-yet is not a hold" statute
  (`we:docs/agent/backlog-workflow.md:521`).
- **Statute reconciliations folded in:** the `Custom[Name]Registry` naming convention
  (`we:docs/agent/platform-decisions.md:626` — registries carry the `Registry` suffix; base classes don't) and
  the registry name-validation guard (`:654-680` — `CustomTemplateTypeRegistry.define()` must guard its
  `type`-value keyspace; the guard grammar is #1987's call).
