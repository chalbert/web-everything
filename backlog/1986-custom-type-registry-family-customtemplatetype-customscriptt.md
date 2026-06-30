---
kind: decision
status: open
dateOpened: "2026-06-30"
dateStarted: "2026-06-30"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-30-typed-inert-container-registries.md
tags: [webdirectives, registration, custom-type-registry, customattribute, customcomment, block-standard, decision]
---

# Custom Type Registry family — CustomTemplateType + CustomScriptType as siblings of CustomComment (retire CustomAttribute as the directive registration path)

**Prepared, ready to ratify.** The *registration mechanism* under the resolved #1983 directive-*form* ruling:
once the form is a typed `<template type="kind">` (inert) / `<!-- ns:name -->` (live), `is=`-free — **which
registry implements `type=`** (mint a sibling vs extend the behavior registry), is it one parameterized registry
or three siblings, and does a `<script type>` sibling earn its place? Grounded in a read of the real FUI tree
**and** a prior-art survey published as the
[`typed-inert-container-registries`](/research/typed-inert-container-registries/) topic (session report linked
via `relatedReport`). The `type=` discriminator itself is **settled by #1983** — not re-litigated here. #1983
explicitly carved this mechanism out as an *open* weigh ("a `CustomTemplateType` registry **vs** `CustomAttribute`",
`we:docs/agent/block-standard.md:397`) — so this is a merit decision, **not** a forced consequence.

## Grounding digest

Two registries already ship as **concrete siblings on one base** — `CustomCommentRegistry` and
`CustomAttributeRegistry` both `extends HTMLRegistry` (`fui:plugs/core/HTMLRegistry.ts:21`), which already carries
the common `define`/`get`/`getLocalNameOf`/name-map shape; each adds only its own `upgrade(root)` walk. The
built control-flow directives (`view:if`/`view:switch`/`for-each`) register on `CustomAttribute` keyed by
attribute **name** (`fui:blocks/view/registerViewDirectives.ts:13-17`); the only `is=` directive is `portal`
(`fui:plugs/webportals/PortalDirective.ts:123`, `fui:plugs/webportals/index.ts:54`). **`<script type="injector">`
is already built** — `applyDeclarativeInjectors` scans `root.querySelectorAll('script[type="injector"]')`,
idempotent ("safe to call again after DOM changes", a `processed` WeakSet),
`fui:plugs/webinjectors/declarativeInjector.ts:107-147`. The feared
`observedAttributes`/`attributeChangedCallback` regression is **already solved in-tree**:
`CustomAttributeRegistry` provides it for non-element hosts via a `MutationObserver` it owns
(`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:526-576,425-427`). Prior art: `<script type>` is a native
open kind-space (unknown types = inert "data blocks", [HTML spec](https://html.spec.whatwg.org/multipage/scripting.html));
`<template type>` has no native precedent but `type=`-as-is-a-kind is the platform's pervasive idiom
(`<input/button/ol/script type>`) vs adjectival `shadowrootmode`; `is=` customized built-ins are WebKit-opposed
([standards-positions#97](https://github.com/WebKit/standards-positions/issues/97)); a runtime registry keyed by
an element discriminator is the dominant framework model (Vue/Angular/Alpine).

## Naming (base class vs registry)

Throughout: **`CustomComment` / `CustomTemplateType` / `CustomScriptType`** are the **base classes** that extend
the native inert nodes (`Comment` / `HTMLTemplateElement` / `HTMLScriptElement`) — siblings of the existing
`CustomComment` (`fui:plugs/webdirectives/CustomComment.ts:27`). Their **registries** carry the machine-checked
`Custom[Name]Registry` suffix (`we:docs/agent/platform-decisions.md:626`):
**`CustomCommentRegistry` / `CustomTemplateTypeRegistry` / `CustomScriptTypeRegistry`**. The title's
`CustomTemplateType` is the base class; the registry it implies is `CustomTemplateTypeRegistry`.

## Axis-framing

#1983 settled the directive **form** and the `type=` **discriminator**; it carved the **registration mechanism**
to here (`we:docs/agent/block-standard.md:397`, rule 5). Above the three forks sits one genuinely *forced*
invariant — `is=`/`CustomTemplateDirective` is retired (already ruled by #1983/#1963). The three weighed axes:
**Fork 1** — the typed-template directive registry: **mint** a `CustomTemplateTypeRegistry` (value-space) vs
**extend** the behavior registry `CustomAttribute` to host a `type`-value branch. This is a *merit* weigh
(semantic directive-vs-behavior + perf template-scoped scan + value-space clarity), the exact "registry vs
`CustomAttribute`" #1983 left open — **not** a structural impossibility. **Fork 2** — the registry **shape**:
three concrete siblings on `HTMLRegistry` vs one parameterized `CustomTypeRegistry`. **Fork 3** — does the
**`CustomScriptType`** sibling get built *now*, given `<script type="injector">` already ships its own boot-scan
(`fui:plugs/webinjectors/declarativeInjector.ts:107`)? The `type`-**value** namespacing (bare `if` vs `acme:card`
vs `acme-card`) is a separate axis **delegated to #1987**.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — directive registry: mint vs extend | **mint `CustomTemplateTypeRegistry`** (value-space, template-scoped) | extend `CustomAttribute` to host a `type`-value branch | high |
| **Fork 2** — registry shape | **three concrete siblings on `HTMLRegistry`** (lift shared `whenDefined` into the base) | one parameterized `CustomTypeRegistry` | high |
| **Fork 3** — `CustomScriptType` now? | **build now** — absorb the existing `applyDeclarativeInjectors` boot-scan as its `upgrade()` | defer until a future consumer | med-high |

*Above the forks sits one **forced invariant** (ratify, not weigh): `is=` / `CustomTemplateDirective` is retired
as the directive registration path; `portal` migrates off `{extends:'template'}`. It is not in the glance table
because there is no branch to pick.*

## Supported by default (not forks)

- **`type=` discriminator** — **settled by #1983** (`we:docs/agent/block-standard.md#directive-form`); an
  "is-a kind" in the `type` value-space (`<template type="if">`). Stated here only so the mechanism is grounded
  against it; no re-decision.
- **`observedAttributes` / `attributeChangedCallback` parity** — a **capability requirement**, not a choice.
  Whichever registry wins Fork 1 must let a directive react to sibling-attribute changes on its host
  `<template>` (`portal` reacts to `target`/`disabled`/`required`, `fui:plugs/webportals/PortalDirective.ts:123`).
  This is provided with the **same `MutationObserver` machinery `CustomAttributeRegistry` already owns**
  (`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:526-576,425-427`) — so retiring the `is=` customized
  built-in (which got `attributeChangedCallback` natively) loses no capability. Required either way, so not
  ratifiable.
- **`type`-value namespacing** → **delegated to #1987** (prepared separately): bare `if` (core) vs a
  prefixed/separated third-party form (`acme:card` vs `acme-card`). Out of scope for *which registry*.

## Forced invariant (ratify — not a fork)

**`is=` / `CustomTemplateDirective` is retired as the directive registration path; `portal` migrates off
`{extends:'template'}`.**

Fork-existence: case (a), a forced invariant — the excluded branch ("keep `is=`/`CustomTemplateDirective` as a
load-bearing directive registration path") is **broken**: #1963 ruled `is=` customized built-ins Safari-never /
never-load-bearing, WebKit's standards-position is *oppose*
([standards-positions#97](https://github.com/WebKit/standards-positions/issues/97)), and the platform itself
moved to discriminate-on-the-element (`ElementInternals.type`). `portal` is load-bearing projection
infrastructure (`fui:plugs/webportals/PortalDirective.ts:123`), so it cannot ride a never-load-bearing mechanism.
This is already ratified by #1983 — restated here only because it bounds Fork 1 (the alternatives in Fork 1 are
both `is=`-free). `is=` stays accepted-for-authors (lower-compliance opt-in), not minted as the contract.

## Fork 1 — the typed-template directive registry: mint `CustomTemplateTypeRegistry` vs extend `CustomAttribute`

**Fork-existence:** a genuine either/or — both branches are coherent and cannot both be the shipped registration
path. The excluded branch is *not broken*, so this is a merit weigh, exactly the "`CustomTemplateType` registry
vs `CustomAttribute`" #1983 left open (`we:docs/agent/block-standard.md:397`). **(Correction from the cold
scaffold + prep skeptic: this was first framed as a forced invariant; it is not. `CustomAttribute` already does
value-keyed sub-dispatch internally — the `-active`/`-when` suffix matching,
`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:534-539` — so "it structurally cannot dispatch on a value" is
false. The default holds on merit, not impossibility.)**

Crux: directives keyed by `<template type="if">` dispatch on the `type` attribute's **value**; `CustomAttribute`
is keyed by attribute **name**, matched **tree-wide** via a `MutationObserver`
(`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:526-576`).

- **(a) Mint `CustomTemplateTypeRegistry`** *(recommended default)* — a value-space registry whose `upgrade`
  walk matches `<template>` by its `type` *value*. Argued on three merits, none of them "impossible":
  - **semantic** — directives are region-control, not element decoration; `CustomAttribute` is the *behavior*
    registry, and #1983's directive-vs-behavior gate (`we:docs/agent/block-standard.md:387-393`, rule 4) keeps
    behaviors (context providers, bindings) on `CustomAttribute`. A dedicated directive registry keeps the two
    catalogs from sharing one keyspace.
  - **perf** — a `<template type>` value-match yields a **template-scoped** candidate set; hosting `type=` on
    `CustomAttribute` means registering the attribute *name* `type`, which its `MutationObserver` then matches
    **tree-wide** against every `<input type>` / `<button type>` / `<script type>`, with value-dispatch
    re-implemented inside that one attribute.
  - **clarity / lock-in** — a value-space registry is a clean sibling of the shipped `CustomCommentRegistry`;
    bending the name-space registry to also be a value-space one couples two dispatch models in one class.
- **(b) Extend `CustomAttribute` to host a `type`-value branch** — *Rejected:* technically possible (the
  suffix-matcher shows value-dispatch is in reach) but it overloads the behavior registry with directive
  semantics, makes the candidate set tree-wide, and re-merges the two catalogs #1983's gate split. The merits
  above are the reason to pay for a new class, not a claim that this branch can't be built.

```ts
// (a) default — a value-space sibling. The ONLY per-sibling logic is the upgrade walk:
//     match `<template type="…">` by the `type` VALUE (not by attribute name, as CustomAttribute would).
export default class CustomTemplateTypeRegistry
  extends HTMLRegistry<TemplateTypeDefinition, CustomTemplateTypeConstructor> {
  localName = 'customTemplateTypes';
  upgrade(root: Node): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n as Element;
      if (el.localName === 'template' && this.has(el.getAttribute('type') ?? '')) {
        this.#upgradeTemplate(el as HTMLTemplateElement); // re-prototype onto the CustomTemplateType subclass
      }
    }
  }
}
// registration mirrors the comment registry: templateTypes.define('if', ViewIfDirective)
// vs (b): attributes.define('type', SomeDispatcher) — matches EVERY `type` attribute tree-wide, then branches.
```

`Skeptic: SURVIVES-WITH-AMENDMENT — the prep skeptic REFUTED the original "forced invariant" framing on
citation-scope (#1983 rule 5 files this as open "vs CustomAttribute", `we:docs/agent/block-standard.md:397`; rule
4 routes behaviors *into* CustomAttribute) and classification (CustomAttribute already value-sub-dispatches,
`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:534-539`). Amendment folded: demoted from forced invariant to
a merit Fork, default **(a) mint** held on semantic + perf + clarity. The default itself survived the merit
attack.`

## Fork 2 — registry shape: three concrete siblings vs one parameterized registry

**Fork-existence:** a genuine either/or — both coherent, cannot both be the shipped shape. The excluded branch is
*over-abstraction*: one parameterized `CustomTypeRegistry` (container + discriminator-extractor + lifecycle) vs
three named classes.

Crux: the **shared shape already exists** — as `HTMLRegistry` (`fui:plugs/core/HTMLRegistry.ts:21`), which
`CustomCommentRegistry` and `CustomAttributeRegistry` already extend as concrete siblings. So "deduplicate the
common shape" is *already done by the base class*; a parameterized registry would re-implement what the base is,
and re-branch the per-container `upgrade` walks internally as a switch.

- **(a) Three concrete sibling registries on `HTMLRegistry`** *(recommended default)* — `CustomCommentRegistry`
  (built), `CustomTemplateTypeRegistry`, `CustomScriptTypeRegistry`, each adding only its own `upgrade(root)`
  walk (`SHOW_COMMENT` tree-walk; `<template type>` value-match; `<script type>` scan). Separate-and-decouple
  (burden of proof on combining); matches the two shipped siblings; variation lives where it belongs, invariant
  in the base. **Amendment (from the skeptic): lift the duplicated `whenDefined` + resolver-map (currently
  copy-pasted across `fui:plugs/webbehaviors/CustomAttributeRegistry.ts:240-248` and
  `fui:plugs/webdirectives/CustomCommentRegistry.ts:115-123`) up into `HTMLRegistry`** — three siblings would
  otherwise make it three copies; lifting it *strengthens* the sibling model rather than favouring the
  god-object.
- **(b) One parameterized `CustomTypeRegistry`** — *Rejected:* re-implements `HTMLRegistry`'s role, couples three
  independently-evolving `upgrade` walks behind one parameter surface, inverts the shipped pattern. No
  deduplication left to win — the base already won it.

`Skeptic: SURVIVES — beat the code-duplication attack: the shared shape is in the base and the existing siblings
are thin (HTMLRegistry owns the name-map; each sibling adds only its upgrade walk), so the god-object would
re-branch the substrate divergence internally. Amendment folded: lift the copy-pasted `whenDefined` into
`HTMLRegistry`.`

## Fork 3 — `CustomScriptType`: build now vs defer

**Fork-existence:** a go/no-go on building the `CustomScriptTypeRegistry` sibling. **(Correction from the prep
skeptic: the cold scaffold + first prep draft said "no built consumer → not-yet." Both are wrong — see below.)**

- **Default: build now (med-high).** Three grounds refute the defer:
  1. **A built consumer already exists.** `<script type="injector">` ships today —
     `applyDeclarativeInjectors` scans `querySelectorAll('script[type="injector"]')`, idempotent
     (`fui:plugs/webinjectors/declarativeInjector.ts:107-147`). That scan **is** an `upgrade(root)` walk in all
     but name; folding it into `CustomScriptTypeRegistry.upgrade()` builds the registry *against a real
     consumer*, not speculatively, and **removes the bespoke scanner** (no over-build — the lifecycle the
     registry owns is exactly the one already hand-rolled).
  2. **"No consumer yet" is a banned defer reason** (`we:docs/agent/backlog-workflow.md:521`): once the mechanism
     contract is codified, a fixture *is* the consumer — build it. A `priority: low` / `awaiting-consumer` park
     here is the soft-park #1620 retired.
  3. **Deferring guarantees duplication.** Leave `CustomScriptType` unbuilt and the *next* `<script type>`
     consumer gets a second bespoke scanner, then both migrate onto the registry later — the exact migration
     churn this item's "complete the one pattern across three inert containers" spine exists to prevent.
- **Defer (the rival) — *Rejected.*** Its only honest form would be a typed `maturityGated`/`blockedBy` with a
  *concrete* trigger, and the once-named trigger is **counterfactual**: #1968 (Context Protocol) **already
  resolved zero-node** — an event front door (`ContextRequestEvent`, bubbling+composed,
  `fui:plugs/webinjectors/ContextProtocol.ts`), explicitly **not** a `<script type>` annotation. So "wait for
  #1968 to land as a script annotation" can never fire.
- **Prior-art delta:** `<script type>` is a native open kind-space (inert "data blocks",
  [HTML spec](https://html.spec.whatwg.org/multipage/scripting.html)); native gives **inertness, not a registry**
  (`HTMLScriptElement.supports()` is closed). The WE value is the `define`/`upgrade`/`whenDefined` lifecycle over
  that inert substrate — and ground 1 shows there is already a lifecycle (the idempotent boot-scan) to own.

`Skeptic: REFUTED the not-yet → flipped to build-now. The defer's named trigger is counterfactual (#1968 resolved
zero-node, no script-type annotation); the defer collides with the codified "no-consumer-yet is not a hold"
statute (`we:docs/agent/backlog-workflow.md:521`, #1620); and a built `<script type="injector">` consumer with a
duplicate boot-scan already exists (`fui:plugs/webinjectors/declarativeInjector.ts:107`). Build now, absorb that
scanner.`

## Statute-overlap (reconciled here, composes — no collision)

#1986 sets `codifiedIn: we:docs/agent/block-standard.md#directive-form` (the slot #1983 left open at `:397`). Two
`we:docs/agent/platform-decisions.md` anchors govern adjacent turf:

- **`Custom[Name]Registry` naming convention** (machine-checked, `we:docs/agent/platform-decisions.md:626`) —
  honored: the registries are `CustomTemplateTypeRegistry` / `CustomScriptTypeRegistry` (suffix present); the
  base classes `CustomTemplateType` / `CustomScriptType` are not registries (they extend native nodes, like
  `CustomComment`). The *(Naming)* section above pins this so the names don't silently drop the suffix.
- **"Registry name-validation guards the host-shared namespace, not every `define()`"**
  (`we:docs/agent/platform-decisions.md:654-680`, lineage #1347/#1120/#1348) — `<template type>` *values* enter a
  host-shared DOM namespace (the `type` attribute, where `module`/`importmap`/`speculationrules` are
  platform-reserved on `<script>`), so per this rule `CustomTemplateTypeRegistry.define()` **must** guard its key
  namespace the way `CustomAttributeRegistry`'s `#assertValidName` does
  (`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:186-192`). A *composition*, not a conflict — the precise
  guard grammar (reserved-token list, third-party prefix) is the **#1987** value-namespacing question, which is
  therefore *constrained* by this statute.

## Relationships

- **Mechanism for** #1983 (resolved) — directives register through `CustomTemplateTypeRegistry`; the form ruling
  stands independently.
- **Delegates** the `type`-value namespacing to **#1987** (prepared separately; constrained by the name-guard
  statute above).
- **Absorbs** the existing `<script type="injector">` boot-scan (`fui:plugs/webinjectors/declarativeInjector.ts:107`)
  into `CustomScriptTypeRegistry.upgrade()` (Fork 3) → ties to **Context Protocol #1968** (resolved zero-node).
- Surfaced from the #1983 prep discussion (2026-06-30); see `we:reports/2026-06-30-directive-authoring-forms.md`
  and the new `we:reports/2026-06-30-typed-inert-container-registries.md`.
