# `scope=` declarative scoped-registration spelling on `<component>` — prior-art survey (decision #854)

**Date:** 2026-06-17
**Grounds:** backlog #854 (the author-facing spelling for scoped registration on `<component>`), carved
out of epic #076 (make more of the custom-element imperative API declarative on `<component>`).
**Builds on #228** (resolved 2026-06-11) — the scoped-registry *runtime* construction fix. The runtime is
**not** the blocker; the spelling is.

## The question

`<component name shadow>…</component>` lowers to a class-based custom element that registers into the
**global** registry: [`we:declarativeComponent.ts:162`](../blocks/renderers/component/declarativeComponent.ts#L162)
emits `customElements.get(tag) ?? customElements.define(tag, Cls)`. The open decision: **how does a
`<component>` declare that it registers into a *scoped* `CustomElementRegistry` rather than the global one,
and how does that align with the native scoped-registry direction?** The item entered prep presuming a
`scope="<registry-id>"` string attribute (its title), with native alignment and lowering listed as
companion concerns.

This survey runs design-first step 1 over the native scoped-registry proposal + the leading web-component
libraries. It **materially reshapes** the framing: the headline presumption (a string-valued `scope=`) has
no platform analog.

## What the survey found

### 1 · The native proposal is no longer a proposal — it shipped, and it keys on objects, not strings

Scoped Custom Element Registries **merged into the WHATWG DOM/HTML Living Standard on 2025-04-14**
([whatwg/dom#1341](https://github.com/whatwg/dom/pull/1341); revamp tracked in
[whatwg/html#10854](https://github.com/whatwg/html/issues/10854)). The settled surface:

| Surface | Spelling | Note |
| --- | --- | --- |
| Construct a scope | `new CustomElementRegistry()` | No longer a singleton; each instance is an independent scope, a **JS object with no `name`/`id`**. |
| Bind a subtree | `element.attachShadow({ mode, customElementRegistry })` | Option is **`customElementRegistry`**, *not* `registry`. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow)) |
| Read the scope | `shadowRoot.customElementRegistry` / `element.customElementRegistry` getters | |
| Imperative create | `document.createElement(name, { customElementRegistry })`, `importNode(...)` | Same option. |
| Late bind / upgrade | `registry.initialize(root)` | Walks the subtree, sets the registry on nodes whose registry is still `null`, upgrades. **Cannot be changed once set.** |
| Default | no option ⇒ **global** registry | Revamp changed default from host's registry to global/document's. |
| Restriction | scoped registries reject `define(…, { extends })` (customized built-ins) → `NotSupportedError` | |

**Browser status (early 2026):** Chrome/Edge **146** shipped; Safari **26** shipped; Firefox **in
progress** ([Bugzilla #1874414](https://bugzilla.mozilla.org/show_bug.cgi?id=1874414), Interop 2026,
pref `dom.scoped-custom-element-registries.enabled`). 2-of-3 engines — *not yet Baseline*, so userland
conventions still matter.

### 2 · There IS a declarative form — but it is boolean-only by deliberate design

The declarative attribute is **`shadowrootcustomelementregistry`** on `<template shadowrootmode="open">`
([Chrome blog](https://developer.chrome.com/blog/scoped-registries); serialization
[whatwg/html#11892](https://github.com/whatwg/html/issues/11892)). It is **presence-only** — the serializer
emits `shadowrootcustomelementregistry=""`. Its *sole* meaning: "this declarative shadow root's registry is
`null` (awaiting init), not the global one." It **does not — and cannot — name a registry.** You bind the
actual registry afterwards from JS via `someRegistry.initialize(shadowRoot)`.

So the platform shipped a declarative form and *deliberately declined to put a registry identifier in
markup.* This is the load-bearing finding: it directly contradicts the item's presumed `scope="<id>"`.

### 3 · No library uses a string-id scope — every one keys on a JS object via the host

| Library | Declaration | Keys on |
| --- | --- | --- |
| [@open-wc/scoped-elements](https://open-wc.org/docs/development/scoped-elements/) | `static scopedElements = { 'my-el': MyEl }` | a per-host `CustomElementRegistry` **object** (`ScopedElementsMixin`) |
| [Lit `@lit-labs/scoped-registry-mixin`](https://www.npmjs.com/package/@lit-labs/scoped-registry-mixin) | `static elementDefinitions = { 'my-el': MyEl }` | a registry **object** attached to the render root |
| [@webcomponents/scoped-custom-element-registry](https://www.npmjs.com/package/@webcomponents/scoped-custom-element-registry) | (polyfill, not a declaration API) | the WICG polyfill — must load first |

None expose a string-named scope. The closest to declarative is open-wc/Lit's `html` template tag, whose
tag names resolve against the mixin's registry **keyed by the host class**, never by a string id.

### 4 · Consumption vs definition-placement — the split the item's `scope=` fused

The native model gives two distinct concerns, and the item's single `scope=` attribute conflated them:

- **Consumption** — *which registry the markup inside resolves against.* Native: `attachShadow({
  customElementRegistry })` (imperative) + `shadowrootcustomelementregistry` (declarative, boolean).
  Subtree-keyed. **This has a declarative form.**
- **Definition placement** — *which registry a definition lands in.* Native: `thatRegistry.define(tag,
  cls)` — **imperative only, no declarative form at all.**

`<component>` is a *definition* element, so its instinctive question ("which registry do I register into?")
is the definition-placement concern — exactly the one the platform gives **no** declarative spelling. A
declarative `scope="<id>"` would therefore be inventing a string-keyed registry namespace that (a) the
platform refused, (b) no library uses, (c) reintroduces a *global string namespace* — the very thing
scoped registries exist to remove — and (d) cannot survive a native DSD round-trip (the native attribute
carries no id).

## How this grounds against the WE tree

- **Runtime is object-keyed already.** The scoped registry plug constructs with object references and
  hierarchical inheritance: `new CustomElementRegistry({ extends: CustomElementRegistry[] })`
  ([`we:plugs/webregistries/CustomElementRegistry.ts:41`](../plugs/webregistries/CustomElementRegistry.ts#L41));
  #228's `ensureNativelyConstructible` registers the real class under a private tag
  ([same file, :28](../plugs/webregistries/CustomElementRegistry.ts#L28)). No string id anywhere.
- **#242 already reserved the seam.** The Auto-Define registry (resolved) ships a `RegistryScope` token
  ([`we:auto-define/defineElement.ts:47`](../blocks/renderers/auto-define/defineElement.ts#L47)) and
  `AutoDefineStrategy.define(tag, ctor, scope?)` ([same file, :79](../blocks/renderers/auto-define/defineElement.ts#L79)),
  default global. So *imperative* scoped placement already has a home — the lowering just passes a scope to
  `define`. **Tension to flag:** that reserved token is `{ readonly id?: string }` — a *string* id, which
  the native survey says has no platform analog. The decision should reconcile this (treat the string id as
  an optional WE-only debug label, with the registry **object** the real key).
- **The block page pre-commits to the contested spelling.** [`we:component.njk:105`](../src/_includes/block-descriptions/component.njk#L105)
  and [`:149`](../src/_includes/block-descriptions/component.njk#L149) already describe a "Tier-2 `scope`
  attribute … global by default." That is a *presumption* this survey challenges; reconcile it at decision
  time (the page should not pre-bless a string `scope` the ruling may not adopt).

## How the fork reshapes

The original three bullets collapse under the standing test:

- **"What does an author write?"** — the **one genuine fork** (mutually-exclusive author surfaces).
- **"Native alignment"** — not a fork; it is the *deciding criterion* (native-first is a WE forced
  invariant). It folds into the default's rationale.
- **"Lowering impact"** — not a fork; a *consequence* of the spelling, already seam-ready via #242's
  `RegistryScope` / `define(tag, ctor, scope)`.

The survey also flips the presumed default. The item's title (`scope="<id>"`) is the branch native-first
**excludes**: the platform shipped a *boolean* declarative form and refused string registry ids; every
library keys on an object. The native-aligned default is therefore a **presence-only boolean marker**
(forwarding the native `shadowrootcustomelementregistry` / `customElementRegistry` path) with the registry
**object** bound imperatively via the #242 seam — not a string attribute.

**Recommended default — Fork 1 option B (native-aligned boolean + imperative object binding), ~80%.**
Residual: whether WE's authoring ergonomics value a human-readable string handle enough to justify owning
the id→registry lookup table the platform declined — if yes, the string `scope=` returns as opt-in sugar
layered on B, not as the base mechanic.

## Classification (per-fork pass)

- **Layer.** Author-facing spelling = a **WE standard** surface on the `<component>` block; the registry
  object + resolution = the **#242 Auto-Define registry** (already a runtime-DI seam). The native
  primitives it forwards (`attachShadow({customElementRegistry})`, `shadowrootcustomelementregistry`) are
  the **implementation** that satisfies it.
- **Protocol or intent?** Neither new — it map-throughs the native scoped-registry surface and reuses the
  ratified #227/#242 Auto-Define protocol. No new protocol minted (native-first map-through).
- **Expose the whole axis / fixed mechanic?** The *boolean scoped-vs-global* marker is the declarative axis
  (settled native map-through → supported by default). *Which* registry object is a runtime-DI concern, not
  an author-markup axis.
- **DI-injectable?** Yes — the registry object rides the #242 `RegistryScope` seam; the running lowering
  consults it (genuine runtime DI, not a devtools provider).
- **Most-permissive default.** Global registry stays the default (native default); scoping is the author's
  opt-in.
- **Seam.** Definition (this fork) stays separate from consumption-binding (the #242 registry seam) — the
  native two-concern split, honoured (bias-to-separation).
