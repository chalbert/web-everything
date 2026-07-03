# The Block Standard — authoring guide + block-spec schema reference

> **Governance home** for the Web Blocks standard (epic [#1040](/backlog/1040-webblocks-protocol-surface-governance-umbrella-79-block-stan/)).
> This is the **type-system / schema** area — every declarable field of a block spec and its meaning.
> The per-area governance sections hang off this home: **lifecycle** (#1092), **taxonomy** (#1093),
> **composability** (#1094). Source of truth: `we:src/_data/blocks/*.json` (one file per block) and the
> validator `we:scripts/check-standards.mjs`.

A **block** is a declarative, registry-rendered UI standard: a contract (what it exposes, what intents it
realizes) that an implementation in Frontier UI satisfies. The spec is **data, not code** — a JSON file
under `we:src/_data/blocks/<id>.json` plus a prose description in
`we:src/_includes/block-descriptions/<id>.njk`. WE owns the *contract*; the impl is `@frontierui/blocks/*`.

---

## The block-spec schema

Every field below is declarable in `we:src/_data/blocks/<id>.json`. The six **always-required** fields are
marked **R**; everything else is optional and present only when it applies.

### Identity & lifecycle

| Field | R | Shape | Meaning |
|---|---|---|---|
| `id` | **R** | kebab-case string | Stable identity; equals the filename and the `/blocks/<id>/` route. Immutable. |
| `name` | **R** | string | Human display name (Title Case). |
| `summary` | **R** | string | One-line description for the catalog card. |
| `status` | **R** | `concept` \| `draft` \| `experimental` \| `active` | Lifecycle stage (the `LIFECYCLE` enum). `active` **requires** `implementedBy`. Governance: #1092. |
| `type` | **R** | `Component` \| `Module` \| `Behavior` \| `Directive` \| `Store` \| `Parser` | The block's kind (the `BLOCK_TYPES` enum). Governance / taxonomy: #1093. |
| `relatedProject` | | string (project id) | The owning Web Project, when the block belongs to one. |

### Contract surface (what crosses the WE→FUI seam)

| Field | Shape | Meaning |
|---|---|---|
| `implementedBy` | string | The canonical impl reference — **must** match `@frontierui/blocks/…` (the contract↔impl link, #170/#659). Required once `status: active`. |
| `exports` | string[] | The public symbols the impl module exports (the export-shape surface the drift gate checks, #927). |
| `extendsClass` | string | The base platform class the impl extends (`CustomAttribute`, `CustomStore`, …) — relevant for `Behavior`/`Store`/`Parser`/`Directive` types. |
| `element` / `tagName` | string | The custom-element tag a `Component` registers (`we-*`). |
| `registryName` / `defaultParserName` | string | For `Parser`/registry-backed blocks: the registry + default member names. |

### CEM surface (Custom Elements Manifest, schema 2.1.0)

The author-facing API of a `Component`, mirroring the CEM vocabulary so generation adapters (#821/#1085)
and autodocs consume it directly.

| Field | Shape | Meaning |
|---|---|---|
| `attributes` | `{ name, type, fieldName?, description }[]` | Observed HTML attributes. |
| `properties` | `{ name, type, reflects?, attribute?, description }[]` | JS properties (CEM `members` of kind `field`). |
| `events` | `{ name: { description } }` **or** `{ name, type, description }[]` | Dispatched events. |
| `slots` | `{ name, description }[]` | Named slots (`name: ""` = the default slot). |
| `cssParts` | `{ name, description }[]` | `::part()` styling hooks. |
| `componentTokens` | object | Design tokens the component reads (webtheme). |

### Composition (how a block realizes & composes intents)

| Field | Shape | Meaning |
|---|---|---|
| `implementsIntent` | string (intent id) | The single intent this block is the runtime of. |
| `composesIntents` | string[] (intent ids) | Intents the block composes (delegates to) rather than implements. Governance / composability: #1094. |
| `intentDimensions` | `{ <dimension>: <value> }` | The intent-dimension values the block fixes (e.g. `{ presentation: 'media' }`). |
| `consumesIntent` | string | An intent the block consumes from scope (injector chain) rather than declaring. |
| `dependsOn` | string[] (block/intent ids) | Hard dependencies on other blocks. |
| `composesWith` | string[] | Soft "pairs well with" relations. |
| `traits` | `{ name, description, intentDimension }[]` | The composable mixin functions the impl exports, each mapped to the intent dimension it realizes (the trait↔dimension link, #776). |

### Narrative & cross-reference

| Field | Shape | Meaning |
|---|---|---|
| `webStandards` | `{ <std>: { usage, reference } }` | **Always present.** The web-platform standards the block aligns to + how it adopts each (native-first evidence). |
| `designDecisions` / `designRationale` | object | Recorded design choices, so they are not re-litigated downstream. |
| `frameworkComparison` | object | How incumbents (React/Vue/etc.) solve the same need — the comparative-value framing. |
| `fuiDemo` | object | The FUI-hosted demo embed descriptor (#701 `fuiDemo` iframe — WE never imports FUI block code). |
| `configuration` / `technicalConfig` / `syntax` / `viewIntegration` / `parserResolution` | object | Type-specific extension blobs (a `Parser`'s grammar, a `Directive`'s syntax, …). |
| `related` / `relatedAdapter` / `relatedReport` / `blocks` | string[] / string | Cross-links to sibling blocks, adapters, reports. |

---

## Authoring a block

1. **Scaffold the spec** — create `we:src/_data/blocks/<id>.json` with the six required fields + a
   `webStandards` entry naming the native primitive you build on (native-first is mandatory).
2. **Write the description** — `we:src/_includes/block-descriptions/<id>.njk` (the validator warns if a
   block has no description). Prose, not schema.
3. **Declare the contract, not the impl** — `attributes`/`properties`/`events`/`slots`/`exports` describe
   the *surface*; the running code is `@frontierui/blocks/<id>/`. Add `implementedBy` when the impl exists.
4. **Wire composition** — `implementsIntent` for the one intent the block *is*; `composesIntents` for the
   ones it *uses*; `traits` mapping each mixin to its intent dimension.
5. **Graduate by lifecycle** — `concept → draft → experimental → active`. Set `status: active` only with
   an `implementedBy` reference (the gate enforces it).

## Validation (what the gate enforces)

`we:scripts/check-standards.mjs` checks, per block:
- `status` is in the `LIFECYCLE` enum; `type` is in `BLOCK_TYPES` (else a warning).
- `status: active` ⇒ `implementedBy` present and pointing at `@frontierui/blocks/…`.
- every block has a `block-descriptions/<id>.njk` (else a missing-description finding).
- export-shape / member-surface drift between the declared CEM surface and the resolved impl (#927/#910).

## Status lifecycle governance (#1092)

A block's `status` moves along one ordered axis — **`concept → draft → experimental → active`** (the
`LIFECYCLE` enum at `we:scripts/check-standards-rules.mjs:567`, shared by the script and the entity
validators via `checkStatus` at `:598`). The stages mean:

| Stage | What it asserts | Typical evidence |
|---|---|---|
| `concept` | The block is *named and scoped* — a placeholder protocol with a summary, possibly nothing else. | A spec file with id/name/summary/type; no impl, often no full CEM surface. |
| `draft` | The contract surface is *being authored* — attributes/properties/events are taking shape but not stable. | A fuller CEM surface; the impl may be in progress in FUI. |
| `experimental` | The contract is *usable but unstable* — it may change without a deprecation. Safe to demo, not to depend on. | A working `@frontierui/blocks/<id>` impl; demos; surface still moving. |
| `active` | The contract is *stable and implemented*. This is the only stage the gate ties to an impl. | **`implementedBy` is required** (gate-enforced at `we:scripts/check-standards.mjs:155`). |

**Graduation criteria (concept→active).** Promote a block only when (1) its CEM surface is settled (no
expected attribute/property churn), (2) a real `@frontierui/blocks/<id>` impl exists and is named by
`implementedBy`, (3) the export-shape / member-surface gate (#927/#910) is clean against that impl, and
(4) a description `block-descriptions/<id>.njk` exists. Demotion is legal (an `active` block whose contract
must change reverts to `experimental`), recorded like any reversal (lineage, not erasure).

**Deprecated synonyms.** `implemented`/`stable`/`done` → `active`; `planned` → `concept`; `wip` → `draft`
(`STATUS_SYNONYMS`, `:598`) — a synonym is auto-fixable to its canonical target; any other value is a hard
status error (the validator never *warns* on status — it errors).

**Currently enforced (this section codifies, does not change):** `status ∈ LIFECYCLE` (error on a bad
value), and `status:active ⇒ implementedBy` — emitted today as a **warning**
(`we:scripts/check-standards.mjs:155`). Whether to tighten that warning to an **error**, or add a
*graduation-demo* gate (an `active` block must ship a runnable conformance demo), is a real
gate-tightening call — **flagged here for a separate `type:decision` follow-up, not decided in this doc.**

## Type taxonomy governance (#1093)

A block's `type` is one of six protocol categories (`BLOCK_TYPES` at
`we:scripts/check-standards.mjs:94`, enforced at `:162`). Pick by *what platform seam the block realizes*:

| `type` | Meaning | Pick it when | Base class / surface |
|---|---|---|---|
| `Component` | A custom element — an author-facing tag with a CEM surface. | The block *is* a tag the author writes (`<we-foo>`). | registers `element`/`tagName` (`we-*`); has attributes/properties/events/slots. |
| `Module` | A foundation that groups a shared engine + specialized sub-blocks; not itself one tag. | The block is a *family root* others build on (e.g. `view`: a render engine + behaviors + directives). | `exports` a shared engine; sub-entities carry their own `type`. |
| `Behavior` | A customized built-in / attribute behavior attached to an existing element. | The block enhances any element via an attribute (`CustomAttribute`). | `extendsClass: CustomAttribute`. |
| `Directive` | A template/comment directive that transforms markup at stamp time. | The block is a typed `<template type=…>` (inert) / `<!-- ns:name -->` (live) directive — **`is=`-free** (#1983, [directive form standard](#directive-form)). | comment-form → `CustomComment`; typed-template form → `CustomTemplateType` (registered via `CustomTemplateTypeRegistry`, **not** `CustomAttribute` — [#1986](#directive-registration-mechanism)); `<script type>` → `CustomScriptType`. **Never `is=`** — `CustomTemplateDirective` is retired (#1983/#1986). |
| `Store` | A reactive state container. | The block holds observable state others bind to. | `extendsClass: CustomStore`. |
| `Parser` | A registry-backed parser member (comment/expression/text-node). | The block contributes a parsing strategy to a registry. | `registryName`/`defaultParserName`. |

**Selection guidance.** If the author writes a *tag* → `Component`. If it attaches via an *attribute* →
`Behavior`. If it transforms *markup* (template/comment) → `Directive`. If it holds *state* → `Store`. If
it contributes a *parsing strategy* → `Parser`. If it is a *family root* bundling an engine + several of
the above → `Module`.

**Drift reconciliation (the `Utility` case).** Every *block-level* `type` in `we:src/_data/blocks/*.json`
is already inside `BLOCK_TYPES` — there is no out-of-set block type today (the gate is clean). The
`type: "Utility"` that appears in the tree is an **export/sub-entity** field of the `view` Module (its
shared render *Engine* — a plain utility class, not a custom-element kind), `we:src/_data/blocks/view.json`.
That is a legitimate, distinct axis: the six-member `BLOCK_TYPES` enum governs the **block's** kind, while a
**sub-entity** may name a non-element role (`Utility` = a shared engine) that the block-type enum
deliberately does not cover. So the reconciliation is *clarification, not reclassification*: `Utility` stays
as an export role, `BLOCK_TYPES` stays six-membered, and the `:162` check correctly applies only to the
block-level `type`. (If a future *block-level* `Utility` is ever wanted, that is a `BLOCK_TYPES` change —
again a separate `type:decision`, not this doc.)

## Composability governance (#1094)

A block declares its place in the composition graph through **six fields**, split across two axes: the
**intent axis** (how a block relates to *intents* — `implementsIntent` / `composesIntents` /
`consumesIntent`) and the **block-graph axis** (how a block relates to *other blocks* — `dependsOn` /
`composesWith`), with `composesBehaviors` (the behavior axis) the third. The rules below say what each
means, when to pick which, and which are gate-enforced.

### The intent axis — implements vs. composes vs. consumes

These three are **mutually distinct** and a block typically uses exactly one `implementsIntent`, plus any
number of the other two. The discriminator is **ownership of the runtime**:

| Field | Cardinality | Meaning | Pick it when |
|---|---|---|---|
| `implementsIntent` | **one** | The block **is** the runtime of that intent — it owns the impl that satisfies the intent's contract. | This block is the canonical realization of the intent (a `data-table` *implements* the table intent). |
| `composesIntents` | many | The block **delegates to** other intents it does not implement — it wires them together but each is realized elsewhere. | The block orchestrates sub-intents whose runtimes are other blocks (a `form` *composes* the validation + reliability intents). |
| `consumesIntent` | one | The block **reads** an intent from scope (the injector chain) rather than declaring or owning it — an ambient dependency resolved at runtime. | The block needs an intent a *provider up-scope* supplies (a row block *consumes* the selection intent from its enclosing grid). |

**The discipline (compose, don't re-implement — #933 / platform-decisions.md#compose-dont-handroll):** a
block must not re-implement an intent another block already `implementsIntent`. If you need its behavior,
`composesIntents` (delegate) or `consumesIntent` (read from scope) — never hand-roll. `implementsIntent`
is a claim of *ownership*; two blocks claiming `implementsIntent` for the same intent is a conflict the
taxonomy (#1093) resolves, not a duplication.

### The behavior axis — `composesBehaviors` (GATE-ENFORCED)

`traits[]` records the named behaviors a block **provides** (`withSortableHeader`, `withRovingFocus`);
`composesBehaviors[]` records the behaviors a block **consumes**. This is the only composition field the
validator **errors** on (`we:scripts/check-standards.mjs`, the #936 / #933-Fork-2 gate):

- The **de-facto behavior registry** is the union of every block's provided `traits[].name`. Each
  `composesBehaviors` entry (a string or `{name}` object) **must resolve** to a name some block provides —
  a declared composition cannot name a behavior no block exposes (the "compose, don't hand-roll" signal:
  if nothing provides it, you are about to hand-roll it).
- `composesBehaviors` must be an **array** (of names or `{name}` objects); a non-array is an error, and an
  entry with no resolvable `name` is an error.
- The legacy field name **`composesTraits` is reserved and rejected** — it collides with *The Map* (the
  trait manifest, `we:src/_data/traits.json`). Authors must use `composesBehaviors`. The gate errors on
  any block still carrying `composesTraits`.

Rule of thumb: a covered interaction (disclosure → `nav:section`, roving focus → `nav:list`) **MUST**
`composesBehaviors` the existing trait, never re-wire it by hand — and the providing block declares the
trait in `traits[]` so the registry sees it. The gate makes a hand-rolled behavior a build failure.

### The block-graph axis — `dependsOn` vs. `composesWith`

These relate a block to **other blocks** (or intents), and the distinction is **hard vs. soft**:

| Field | Strength | Meaning | Graph rule |
|---|---|---|---|
| `dependsOn` | **hard** | The block **does not function** without the referenced block/intent present — a structural prerequisite. | Forms a **directed dependency graph**: it must stay **acyclic** (no block may transitively `dependsOn` itself), and a `status: active` block should not `dependsOn` a `concept`/`draft` block (a shipped block resting on an unbuilt one). Each id should resolve to a known block or intent. |
| `composesWith` | **soft** | The block **pairs well with** another but stands alone without it — an advisory "these go together" relation. | Non-load-bearing; **symmetric in spirit** (if A pairs with B, B pairs with A) but not gate-enforced. Used for catalog cross-linking and authoring guidance, never for resolution. |

**Why the split (Bias-toward-Separation):** keeping a hard prerequisite (`dependsOn`) distinct from an
advisory affinity (`composesWith`) means tooling can build a real prerequisite graph (ordering,
availability checks) without an advisory pairing polluting it. Collapsing them would make every "pairs
well" note look like a hard edge.

> **Current gate coverage (honest scope).** Of the six fields, **only `composesBehaviors`/`composesTraits`
> is validator-enforced today.** The intent-axis discipline and the `dependsOn` acyclicity / status-floor
> rules above are **authoring governance** documented here (and reviewed at authoring time), not yet
> machine-checked. A future slice may add a `dependsOn`-cycle / unresolved-ref gate and an
> `implementsIntent`-uniqueness gate; until then this section is the source of truth for the rules.

## Packaging governance (#1321)

How a block is *packaged* — its authoring surface, runtime DOM shape, and CSS isolation. Ratified by
[#1321](/backlog/1321-variant-component-surface-and-per-variant-loading-one-polymo/) (2026-06-21). The
per-block *mechanism pick* for the button (the worked example) is carved to
[#1381](/backlog/1381-button-packaging-pick-runtime-shape-mechanism-transient-vs-p/).

1. **Uniform authoring surface.** Every block is authored the same way — one custom-element spelling
   (`<we-button variant>`) across the catalog, consumed identically. **Uniformity binds the *authoring*
   surface, not the runtime DOM shape.**
2. **Nothing is forbidden — compliance is a spectrum, not a gate.** WE mandates nothing
   (*support-all-coherent*, *minimize-lock-in*). A block that deviates from the conformant shape isn't
   *prohibited* — it **forgoes specific compliance guarantees**, and the consequence is that an integration
   relying on them may break. Never a hard blocker; a risk the author accepts. (So the *no-element / CSS-only*
   pattern — classes on a bare native element — and `is="…"` customized built-ins are *lower-compliance*
   choices, not disallowed ones.)
3. **Runtime shape is a per-block impl choice — three families**, all behind the same authoring surface:
   - **(A) Transient → native** (`TransientElement` self-replacement, `fui:blocks/transient/`): authored as a
     custom element, self-replaces with a native element, **zero wrapper**. Native form/a11y free; no
     `ElementInternals`. *Cost:* element gone after replacement (no post-render re-resolution / tag-inspection).
   - **(B) Persistent light-DOM element**: a custom element owns a real light-DOM control. Native semantics
     free; no `ElementInternals`; wrapper persists (use when post-render reactivity / stable identity matters).
   - **(C) Shadow**: a runtime DOM boundary. Use for hostile-CSS immunity / hiding internals. **Pays
     `ElementInternals`** (form participation can't cross the boundary) **+ `::part`** (theming). The
     `ElementInternals` tax is a *shadow-only* cost.
4. **Encapsulation is available in both light DOM and shadow.** Light-DOM families (A/B) get in-leak
   isolation from the **#1349 `webisolation` contract** (`@scope isolated`, csswg #11002, or a keying
   transform until baseline); shadow (C) gets it from its own boundary. Encapsulation is **not**
   shadow-exclusive. Keeps #1349's support-both (no amend).
5. **Variant / styling-hook surface.** A behavior-free style axis is a plain attribute consumed by CSS
   (bare `variant`, #1318) + **token DI** read source-blind (`var(--btn-bg, …)`). One element, the
   open-numbered attribute — **never** per-variant tags. The *no-conflict* guarantee is enforced by the
   boundary (C) or `webisolation` (A/B).
6. **Tag name is a contract artifact.** WE may define a **default, customizable** `we-*` tagName (a *name*,
   like an attribute name — consistent with *contracts-only*; customizable per
   *config-extends-platform-default* + *most-flexible-default*). Base examples are standard-anchored
   (`we-button`), not implementer-spelled (FUI uses bare-kebab, no `fui-` prefix, #841; names need a hyphen,
   #1120).
7. **Per-block mechanism selection — the decision rule (#1381; amended by
   [#1962](/backlog/1962-transient-self-erasing-element-viability-as-a-concept-vs-the/), 2026-07-01 →
   wrapper-first).** Within the default **S1** strategy, pick a block's runtime family by what its *primary*
   consumer needs, not by effort. Ratified by
   [#1381](/backlog/1381-button-packaging-pick-runtime-shape-mechanism-transient-vs-p/) (2026-06-21); **#1962
   reversed the default from transient (A) to persistent-wrapper / light-DOM** — web components are the common
   case and self-erasure is spec-unsanctioned, so transient is avoided unless there is an absolute killer use case:
   - **Behavior-free presentational leaf** (badge, tag, card, section-card, auto-heading, progress, meter,
     filter-chip) → **light-DOM, shape by the reproducibility test** (amended by
     [#2028](/backlog/2028-persistent-light-dom-base-element-contract-for-the-soft-7-pr/), 2026-07-01). No
     self-erasure. Pick the leaf's node shape by what the native element *contributes*:
     - *Host-reproducible* (semantics = role + ARIA only: `<span>`/`<div>`/headings/landmarks) → **host-is-the-node**:
       the `<we-*>` custom element carries the `.fui-*` class and its role/aria via `ElementInternals`, **zero
       sub-element** (the budgeted-host-node spine, below). Default for badge, tag, card, section-card, auto-heading.
     - *Irreplaceable-native* (unique rendering/interaction: `<progress>`, `<meter>`) → **wrap a real native child**
       inside a `display:contents` host (role/aria on the child). This is (B) applied to a presentational leaf.
     - *Content-model-constrained* (parent accepts only the real tag) → the reserved transient (A) below.
     Behaviors ride `CustomAttribute`s on the host. (#1962's earlier "`display:contents` wrapper where a box would
     break flex/grid" phrasing is superseded: `display:contents` is now specific to the wrap-child leaves, not a
     universal shell.)
   - **Single native control** (button, text-field, number-input, temporal/color/file pickers) → **(B) persistent
     wrapper containing a real native control** (the Shoelace `<sl-input>` shape). The inner real element delivers
     every native behaviour (focus/activation/form/IME/picker chrome/validation); the host persists as the styled,
     nameable, CEM-carrying identity. Behaviors ride `CustomAttribute`s on the host or the inner control.
   - **(A) Transient self-erase → native is RESERVED** for one absolute case — a **content-model-constrained
     native child** (`<option>` in `<select>`, `<tr>`/`<td>` in `<table>`, `<summary>` in `<details>`) where a
     wrapper structurally breaks the native parent (WebKit's retained parser case). No current block qualifies;
     transient ships nowhere today. When used it carries the #1961 robustness rider (idempotent +
     microtask-deferred + `isConnected`-guarded).
   - **Framework-bound / reactive** block (a consumer holding a JS ref that sets object/function properties
     post-mount) → **(B) persistent light-DOM element**. The only family that keeps a persistent element to
     bind to; also the shape a deployment upgrades to C when it opts into S2.
   - **Block facing hostile / unknown host CSS** that opts into **#1349 S2** → **(C) shadow** (pays the
     `ElementInternals` + `::part` tax, per item 3).
   A persistent "property-forwarding" wrapper over a transient element is **not** a fourth option — it *is*
   (B). Tag applies to both A and B (transient registers a global tag to upgrade-then-erase). The remaining
   block conversions are a separately-prioritized build epic
   ([#1442](/backlog/1442-block-model-conversion-register-remaining-blocks-as-custom-e/)), not authored here.
   - *Worked example — form-control family
     ([#1456](/backlog/1456-grouped-form-control-packaging-mechanism-transient-a-vs-pers/); amended by #1962):* a
     **single** control (single checkbox, text-field, number-input) → **(B)** persistent wrapper containing a real
     native `<input>` (the input was already nested in a `<div class="fui-text-field">` — transient only erased the
     outer host, buying nothing native); a **grouped** control (checkbox-group, radio-group) → **(B)** persistent
     light-DOM, because the group's composite `value`/`values` is a live two-way-binding surface.
   - *Element-over-behavior — coordinator blocks
     ([#1457](/backlog/1457-behavior-blocks-do-stepper-deck-tabs-get-a-we-element-or-sta/)):* a block that
     coordinates a set of authored native semantic children (stepper, deck, tabs) ships **both facades over
     one kernel**, divided by the **"can do" vs "is a"** test. A behavior (`CustomAttribute`) is a *"can do
     that"* — a headless capability attached to a host the author owns; an element/block is an *"is a"* — the
     styled, packaged, nameable, framework-flavorable component. So the **styled FUI component is a `we-`
     element** (`<we-stepper>`/`<we-deck>`/`<we-tabs>`): a **(B)** persistent light-DOM element hosting the
     coordination kernel, carrying the styling **and** the **CEM** surface the polyglot generator (#463/#855)
     reads — **no element ⇒ no CEM ⇒ no turnkey styled component and no framework flavor.** The behavior is
     *retained* as the headless `can-do` floor (attach coordination to your own markup, the #1381
     "behaviors riding native elements" end-state). **Even though a behavior *can* technically apply style
     classes, it should not** — owning a styled identity is an `is-a` concern; folding it into a `can-do`
     behavior is a category error (the trap #1457's prep fell into by classifying these as
     "coordinators → no element"). Children stay light-DOM (never shadowed by default), so native semantics
     are preserved; in-leak isolation rides the #1349 `webisolation` contract, shadow (C) only on an S2
     opt-in. **Generalizable rule:** *is it a thing or a capability?* A thing you instantiate / style / name
     / generate flavors of → **element/block**; a capability you attach to enhance a host → **behavior**;
     they compose, the element is the styled product, the behavior the floor.
8. **Transient (A) exposed-API contract — the stable read surface across self-replacement (#1961).** {#transient-exposed-api}
   Ratified by [#1961](/backlog/1961-transient-element-exposed-api-the-stable-read-event-surface-/) (2026-07-01).
   **Scoped by #1962 (2026-07-01):** transient is now the *reserved* content-model-child mechanism, not a shipped
   block shape — this contract governs that reserved case, not the (now wrapper/light-DOM) block catalog:
   - **A replaced transient host is *detached*, not *dead*.** Per the DOM standard a removed node is a valid
     *disconnected* node — operations on it **silently no-op, never throw** (`getBoundingClientRect` all-zero,
     `addEventListener` binds-but-never-fires, etc.), so misuse is invisible, not loud. **Never hold a
     transient-element reference across its upgrade; re-query live from a stable ancestor.** If a ref genuinely
     must be retained, gate on **`Node.isConnected`** — the platform's own liveness primitive — not a bespoke
     `isAlive` flag or `try/catch` (native-first, #75).
   - **Consumer wiring rider (#1960, 2026-07-02): delegate on a stable ancestor — never bind to the transient
     host.** `replaceWith()` discards the host's *own* listeners (the DOM exposes no API to enumerate/transfer
     them, so no base-class fix is possible); child nodes are *moved*, so listeners on children survive. Wire
     behaviour via a delegated listener on a stable ancestor (container or `document`), re-query live, and read
     state from the attributes that survive the upgrade (`data-*`, the live a11y state key) on the resulting
     native element. Binding directly to the transient host is the shipped-twice regression this rider exists
     to prevent ([#1960](/backlog/1960-we-fui-filter-chip-upgrade-listener-contract/)).
   - **Identity is phase-stable — the survivor keeps the authored identity attribute *un-renamed*.** The base
     must **not** exclude the identity attribute (e.g. `value`), so it copies verbatim onto the survivor and a
     consumer reads the **same attribute name** pre- and post-upgrade. This *is* item 7's "attribute-shaped
     reactivity is kept" (:271) applied to identity — free, no sync burden.
   - **The one sanctioned rename is the a11y state key.** `selected`→`aria-pressed` (ARIA-forced for a toggle
     button) is the single explicit carve-out to the keep-the-attribute rule above; read the live
     `aria-pressed` at interaction time. No *identity* rename is ever justified.
   - **No stable change `CustomEvent` by default** (deferred, not shipped — YAGNI; a custom event double-fires
     with native `click`). Consumers delegate on native `click` + read `aria-pressed`. *(#1960, resolved
     2026-07-02, dissolved the former standing un-gate trigger: post-migration (#2122) the chip is a
     persistent B-family host where a change event is an ordinary convention-following feature — filed like
     any other build if a consumer materializes, not tracked as a fork.)*

## Native-element reproducibility taxonomy (#2059) {#reproducibility-taxonomy}

Ratified by [#2059](/backlog/2059-native-element-reproducibility-taxonomy-classify-all-html-ta/) (2026-07-01). The
[#2028](/backlog/2028-persistent-light-dom-base-element-contract-for-the-soft-7-pr/) **reproducibility test** (§7,
:264–301) is a per-block judgment. This section **spends that judgment once, exhaustively**, so a new block wrapping a
native tag inherits **one lookup instead of re-deriving the bucket**. Every native HTML tag is classified into exactly
one of #2028's three buckets:

1. **Host-reproducible (HR)** — the tag's *entire* contribution is a **role + ARIA + default CSS** that a
   `<we-*>` custom element can carry itself via `ElementInternals` (role/aria) plus a `.fui-*` class (box/CSS). Shape:
   **host-is-the-node, zero sub-element** — the custom element *is* the styled node. Reproducible because a bare
   `<div>`/`<span>` + `role` + `aria-*` + CSS is behaviourally indistinguishable from the native tag.
2. **Irreplaceable-native (IN)** — the tag renders **UA-drawn chrome or delivers interaction/behaviour** that a
   `<div>`+ARIA cannot reproduce (native focus/activation, form participation & submission, IME/picker chrome,
   validation, UA-painted controls, media pipelines, replaced-element layout). Shape: **wrap a real native child**
   (`#1962` (B); the child gets role/aria, the host is `display:contents` or a persistent wrapper).
3. **Content-model-constrained (CMC)** — the tag is HR/IN *and* its parent's **content model accepts only that exact
   tag** (a wrapper would break parsing/layout of the native parent). Shape: **reserved transient** (`#1962` (A)) — the
   only sanctioned use of self-erasure. This bucket is a *modifier* on 1/2: a tag is CMC only in the parent contexts
   listed; standalone it falls back to its HR/IN base.

### The classification table

**Bucket 1 — Host-reproducible (host-is-the-node via `ElementInternals`).** Contribute only semantics + default box:

- **Flow / phrasing containers & text:** `div`, `span`, `p`, `pre`, `blockquote`, `figure`, `figcaption`, `main`,
  `header`, `footer`, `article`, `section`, `aside`, `nav`, `address`, `hgroup`, `search`, `menu`.
- **Headings:** `h1`–`h6` (auto-heading rides here).
- **Grouping & lists:** `ul`, `ol`, `dl`, `dt`, `dd`, `figure`, `hr` (semantic separator — a `role="separator"` box).
- **Inline semantics (role/emphasis only):** `strong`, `em`, `b`, `i`, `u`, `s`, `small`, `mark`, `abbr`, `cite`,
  `code`, `kbd`, `samp`, `var`, `dfn`, `q`, `sub`, `sup`, `time`, `data`, `bdi`, `bdo`, `ruby`/`rt`/`rp`, `wbr`, `span`.
- **Sectioning label roles:** the FUI leaves that live here — **badge, tag, card, section-card** (a `.fui-*`-styled
  box) — plus any presentational-only wrapper.

**Bucket 2 — Irreplaceable-native (wrap a real native child).** Deliver UA chrome / interaction / replaced layout:

- **Form controls & submission:** `input` (all `type=`), `textarea`, `select`, `button`, `output`, `label`,
  `fieldset`, `legend`, `datalist`, `optgroup`, `option`, `form`. (Native focus/activation, form participation,
  IME/picker chrome, constraint validation — none reproducible on a `<div>`.)
- **UA-painted gauges:** `progress`, `meter` (the soft-7 wrap-child pair — the concrete #2028 (B) pilots).
- **Disclosure & dialog:** `details`, `summary`, `dialog` (UA open/close + top-layer + backdrop + `::backdrop`).
- **Media & embedded / replaced elements:** `img`, `picture`/`source`, `video`, `audio`, `track`, `canvas`, `svg`,
  `math`, `iframe`, `embed`, `object`, `map`/`area`, `portal`.
- **Interactive text:** `a` (only when `href` — the activation/navigation behaviour; a bare `<a>` with no `href` is
  HR), `map`/`area`.
- **Table rendering:** the `<table>` box model is UA-drawn (see also CMC below for its children).

**Bucket 3 — Content-model-constrained (reserved transient; a modifier on the parent context).** Only these
parent→child pairs force the exact tag, so a wrapper breaks the native parent:

- `option` / `optgroup` inside `select` / `datalist`.
- `tr`, `td`, `th`, `thead`, `tbody`, `tfoot`, `caption`, `colgroup`, `col` inside `table`.
- `li` inside `ul` / `ol` / `menu`; `dt` / `dd` inside `dl`.
- `summary` inside `details`.
- `figcaption` inside `figure`; `legend` inside `fieldset`; `rt` / `rp` inside `ruby`.
- `source` / `track` inside `picture` / `video` / `audio`; `area` inside `map`.

Standalone (not under the listed parent) each of these falls back to its base bucket — e.g. a `<li>` used outside a
list is HR. **No current block qualifies as CMC**, matching §7:288 — the reserved transient ships nowhere today.

**Non-rendered / metadata tags** (`html`, `head`, `body`, `title`, `meta`, `link`, `base`, `style`, `script`,
`noscript`, `template`, `slot`) are **out of scope** — they are not block-packaging candidates (no styled component
wraps them).

### How a block uses this

At authoring time, look up the native tag the block wraps: **HR → host-is-the-node** (extend the #2028 base with
`childTag() → null`); **IN → wrap-child** (`childTag() → '<tag>'`, `display:contents` host); **CMC → reserved
transient** (only if the block is authored *inside* the constraining parent, which no catalog block is). This replaces
the per-block reproducibility judgment with a table lookup; a genuinely novel tag not listed here is classified by
applying the bucket-1/2/3 *definitions* above, and the table is extended.

## Feed-mechanism governance (#2007) {#feed-mechanism}

Ratified by [#2007](/backlog/2007-feed-mechanism-governance-a-block-owning-rendered-shape-must/) (2026-07-01)
as a **consolidating authoring note** — it names one discriminator authors apply at authoring time and points
at the statute cluster that already governs the ground. It writes no new substance; it relocates and names the
existing #1818 / #1570 / #1867 rules where a block author actually looks (`codifiedIn: #1818, #1570`).

**The discriminator — does the block *re-render/restructure*, or *enhance in place*?** How a block is fed its
source of truth follows from that one test:

- **A `we-` block that re-renders or restructures its output** (sort by rebuilding, mobile card view,
  re-layout) **is fed inert data** — an inert `<template>` or an `[[ ref ]]` attr-expression (per
  [#block-data-ingestion](platform-decisions.md#block-data-ingestion) #1818 /
  [#persistent-b-data-source](platform-decisions.md#persistent-b-data-source) #1570) — **never live author
  markup as its source.** Re-rendering clobbers consumer-owned DOM on the first `replaceChildren`/`innerHTML=''`
  (the build↔client skew #1867 set out to kill), so a block that wants freedom over the rendered *shape* must
  not be handed the finished shape.
- **A structure-preserving in-place enhancer** (a light-DOM-scan kernel #1570; the #1867 data-table SSR
  enhancer) **legitimately reads a live SSR subtree** — provided its *source of truth is `data-*` typed data on
  the nodes*, and it only reorders/hides existing nodes, never reparsing rendered text and never restructuring.
  **This is the ratified default, not a violation.**

The canonical *compliant* live-DOM exemplar is the **#1867 SSR data-table enhancer**
([#ssr-data-table-build-harness](platform-decisions.md#ssr-data-table-build-harness)): fed a live `<table>`
whose cells carry `data-sort-value`, it reorders/hides existing rows off those keys — live DOM present, source
of truth is data. The *violating* shape is a block that treats hand-authored markup as its data source and
restructures it **without** the `data-*` contract.

There is no third lane: a block cannot both be fed live already-rendered markup as source **and** restructure
it (re-rendering destroys the fed markup) — so this is not a fork, it is the #1570/#1818 kernel-shape split
named for authors. (The inert-`<template>` vs live-comment-boundary distinction in the directive-form standard,
[#1983](#directive-form)/[#1986](#directive-registration-mechanism), is scoped by its own rule 4 to *directive
bodies*, not block-feed; cite it here only as a supporting analogy, not authority.)

## Composition rubric (#1963) {#composition-rubric}

Ratified by [#1963](/backlog/1963-composition-rubric-re-judged-to-framework-parity-strict-per-/) (2026-06-29). §7
(Packaging governance) governs a *block's runtime shape* (A/B/C); this rubric is the **higher standing test** over
the **broader composition surface** (the dom-less A–I catalog) and licenses future mechanism choices. Different
altitudes — where they touch the same cell, **this rubric governs and §7's consumer-need applies beneath it.** The
full per-case matrix, mechanism catalog, and worked examples live in #1963; the codified rules:

1. **The 5-point acceptance bar** (the standing test for any mechanism choice): ergonomics ≥ frameworks · zero
   layout/CSS/a11y compromise (#1962 cost enum) · a no-compromise solution for *every* case · invent-a-plug where
   none clears (*Plug = Proposed Missing Standard*, #95) · clean in **plain HTML and JSX**. Codifying the test and
   grading a cell already-passed are different rulings — the bar's first act is to mark the cell it **fails**
   (case-10-in-HTML).
2. **The budgeted-host-node spine — *scoped*.** The host node is the API surface (slot/shadow/AX-identity/lifecycle
   are keyed off it), so **budget it**: pay a registered host only for those, route everything else through a
   zero-node mechanism. Yields full zero-node parity on **JS/JSX**; **cheap-node (not zero) on declarative HTML** —
   deep structural nesting there is an open gap (rule 7).
3. **Two audiences — FIXED / CONFIGURABLE / FREEDOM.**
   - **FIXED** (the standard forces): the bar; the scoped spine; the per-layer native/plug partition (rule 5);
     irreplaceable-native blocks emit native — **satisfied by a persistent wrapper *containing* a real native
     control, not a self-erasing host (#1962)**; the statute bars (no load-bearing `is=`; single-substrate floor;
     MaaS serves only platform-correct variants).
   - **CONFIGURABLE** (per-project, **platform-correct variants only**): which sanctioned variant the
     configurator/MaaS assembles — native-first **default**, alternative **opt-in**. (**#1962 withdrew the
     transient ↔ light-DOM per-project toggle for soft blocks**: presentational leaves are light-DOM full-stop, not
     a self-erasure opt-in.) A **substrate swap** (a load-bearing non-standard shim like polyfilled `is=`) is
     **never** configurable.
   - **FREEDOM** (the dev's call): which mechanism per case, from the catalog/matrix with pros/cons.
4. **`is=` is not a WE mechanism.** Every job is dominated — load-bearing native output → **a persistent wrapper
   containing a real native control** (transient reserved for content-model children — #1962); behaviour
   on an authored element → **`CustomAttribute`** (in-place, cross-browser, single-substrate — beats `is=` on every
   axis); persistent live instance → **(B)**; foreign in-place → no real need. WE documents `is=` **only as an
   opt-in developer option** (polyfill in FUI, enabled by explicit dev choice; lower-compliance, §7-spectrum) —
   never a block mechanism, never default.
5. **Per-layer native/plug + plug-to-direction.** Decompose a capability: a layer **present** in a shippable
   browser → **native** (a real native element inside a persistent wrapper — never polyfill what already ships;
   transient reserved for content-model children, #1962); a layer **absent** from
   every spec → **plug**, riding the real native element (the wrapper's inner control) as a `CustomAttribute`. Author each plug to align with its
   **standards-track candidate** (DOM Parts `ChildNodePart`; `ElementInternals.type` #11061; the WC-CG Context
   Protocol; the signals proposal; `moveBefore()`) so it **deprecates + migrates to native** when the standard
   ships.
6. **Behaviour vs directive — behaviour is first-choice.** `CustomAttribute` (decorate a *connected* element) is
   the default; a comment-anchor **directive** is the exception, for **pre-connection / region control** only —
   gating *whether* an element connects (`ViewIf`), *how many times* (`ForEach`), or transforming a region before
   its contents upgrade. A behaviour attaches *after* its element connects, so it cannot prevent/multiply that
   connection — only a directive can.
7. **Per-case verdicts** (full matrix in #1963): cases 4/5, 7 ✅; cases 2, 3, 6, 9 ◐ (named confirms — **case 6 is
   strongest via the Context Protocol**, zero-node DI; `webinjectors` #1044 aligns to it); case 1 → **#1962**
   (resolved 2026-07-01 → **wrapper-first**: persistent wrapper containing a real native control; transient
   reserved for content-model children). **Case 8 is covered** (`is=` jobs all dominated; the owned-element
   behavioural residual is a standards-watch on `ElementInternals.type` #11061). **Case 10 declarative-HTML deep
   *structural* nesting is ⚠️ UNMET** — the structural mechanism is **comment-anchor directives, not transient**
   (transient has no native-element target there); the residual is the **Phase-2 nested-directive
   lifecycle-composition** build (foundation #1130/#1217; the rest carved as a child of #1963). Providers are
   zero-node via the Context Protocol, so the residual is structural/layout layers only.

## Directive form standard (#1983) {#directive-form}

Ratified 2026-06-30 ([#1983](/backlog/1983-directive-form-standard-comment-vs-template-form-reconcile-t/)),
extending composition-rubric **rule 6** (behaviour-vs-directive). The catalog-wide **authoring form** for a
directive — the markup vehicle carrying its name + options + body. The rule #1977 / #1976 / #1978–#1981 apply.

1. **`is=` is not the minted directive-form contract.** A directive is never *standardized* as a customized
   built-in (`<template is="…">`, `extends HTMLTemplateElement`). `is=` stays **accepted-for-authors** — a
   lower-compliance opt-in, per rule 2's "nothing forbidden" (#1321) — but **no catalog directive is built to
   it** (Safari-never, *never load-bearing* per rubric rule 4). The built `portal` migrates off
   `{extends:'template'}` (its `<template is="portal-directive">` shape supersedes the #1000 Fork-4 authoring
   detail — cite in the migration child).

2. **Three forms, by body shape:**

   | Body | Canonical form |
   |---|---|
   | **inert** (deferred / branch-selected / held) | `<template type="kind">…</template>` — multi-region → nested `<template case\|slot="x">` |
   | **live** (renders as-authored) | `<!-- ns:name -->live…<!-- /ns:name -->` comment boundary (**no `<template>`**) |
   | **mixed** (live primary + inert auxiliary) | comment boundary **hosting a nested inert `<template>`** (error-boundary: live content + inert fallback; defer: live placeholder + inert content) — composes the two, no fourth form |
   | **none** (metadata on a subtree) | structural annotation (attribute on a connected element / `<script type="…">`) |

   A `<template>` appears **only** for inert content (it is the platform's only inert container).

3. **`type=` is the typed-`<template>` discriminator — an "is-a" kind.** `<template type="if">` *is a*
   conditional, exactly as `<input type="checkbox">` / `<script type="module">` — the platform's idiom for an
   open registry of kinds on an inert container (`<script type>` is the direct precedent; `shadowrootmode` is a
   *mode*, not the precedent). One `type` per template ⇒ **one directive kind per template, compose by nesting**
   (a `for-each` whose body holds an `if`), never two stacked on one node. Colon-namespaced decorator attributes
   (`view:if`) have **no native analog** (colons in HTML are XML/foreign-content only) and are not the form.

4. **Directive-vs-behavior gate** (sharpens rule 6 at the form layer). These forms are for **directives** —
   region control (whether / how-many / when / where / in-what-form content exists). A construct that decorates
   or reactively updates a *connected* element is a **behavior**, not a directive, and takes **none** of these
   forms — even a no-body annotation. Misroutes this catches: a **context provider** (decorates a subtree's
   scope → `CustomAttribute`; semantics live in the Context Protocol #1968) and **text / attribute bindings**
   (`${}` → `CustomTextNode`, `:attr` → webexpressions). The discriminator is **"no region control,"** not "no
   body."

5. **Downstream (settled separately):** the *registration mechanism* is ratified below
   ([Directive registration mechanism (#1986)](#directive-registration-mechanism)); the `type`-**value**
   namespacing (bare keyword vs prefixed; the colon review) is
   [#1987](/backlog/1987-attribute-naming-convention-review-colon-namespacing-view-if/). #1983 settles the
   **form + discriminator shape**; #1986 settles the **mechanism**; #1987 settles the **value spelling**.

## CustomNode recipes — `customNodes` (#2074) {#custom-node-recipes}

Ratified 2026-07-01 ([#2074](/backlog/2074-customnoderegistry-node-kind-extensibility-standard/)), the **general
frame** the #1986 directive registries (below) are instances of. A reversible WE proposal (open mind — statute
supersedes with lineage, never erases).

`customNodes` is `customElements` one keying over: a registry for node kinds keyed by a **delimiter grammar**
instead of a tag. The rules:

1. **Declared like a custom element.** `customNodes.define(class X extends CustomNode { static <config>; <methods> })`
   — **static fields** for config, **methods** (incl. the full lifecycle) for behavior. `CustomNode` is the single
   base; the class is named and `instanceof CustomNode` / `instanceof X` both hold.
2. **Firewall — the host is a polyfill outcome, never authored.** The standard declares the class + static config +
   behavior. Which native node materializes it (`Text` · `Comment` · an element · `<template>`) is FUI's call and
   **never a new `nodeType`**. Do not name a concrete host class or a walk in the standard.
3. **Nature = which static field is set** (self-documenting): `static value = 'shown'|'hidden'` (an expression) ·
   `static children = 'inert'|'live'|'raw'` (a region — `'inert'` = the `<template>` concept, `'live'` = rendered in
   place, `'raw'` = **scan-suppression**: the region's content is excluded from *all* recipe scanning, delimiters
   inside are inert literal content and the polyfill leaves existing nodes untouched (text stays text, markup stays
   markup) — how a flavor's own raw construct (`{% raw %}`, `@verbatim`) is declared, #2112 Fork 3) · neither +
   `static rendered` (a marker; `false` = invisible directive). Plus `static open`/`close`
   (+`regionName`/`regionClose` for regions) and `static observedAttributes` (exactly like a custom element).
4. **`close` is author-declared, not auto-derived** — auto-derivation must guess base-delimiter vs sigil and breaks
   on real grammars (`<%=`↔`%>`, `@{`↔`}`, `@if`↔`@endif`). **Reverse-mirror the base + name-echo the region** is a
   *recommended convention*, adopted as the **WE authoring house style** for WE's own blocks — never enforced on
   userland.
5. **Scope = the delimiter-keyed surface only.** Tag-keyed is `customElements`; attribute-keyed is the webdirectives
   *attribute* registry; the doctype is a native singleton — all **framed, not re-owned**. Invisibility is
   `rendered:false`/`value:'hidden'`, never comment syntax (the comment grammar is only an optional pre-JS-invisible
   authoring choice). Attribute-value interpolation (`class="{{x}}"`) is a **sibling** surface, out of scope.

6. **Legal `static open` values — a host-token blocklist, not a marked userland subspace** (#2112 Fork 1, ratified
   2026-07-03). `customNodes.define()` throws **`ReservedDelimiterError`** at registration iff `open` is rooted in the
   HTML tokenizer's **tag-open slice** — `<` followed by `!`, `/`, `?`, or an ASCII letter (`<!`, `</`, `<?`, `<div`).
   Rationale: such an open is *cross-channel incoherent* — typed raw in markup the tokenizer consumes it as markup (a
   tag / bogus comment) before text-node scanning runs, while the identical string arriving as escaped / `textContent`
   Text is matchable — so the recipe fires on some authoring channels and not others. That is a name-legality defect
   (the `customElements.define` invalid-name `SyntaxError` analogue), a define()-time **error**, not a warn. **Every
   other open is userland-legal** (`<%`, `{{`, `[[`, `{#`, …), arbitrated by the rule 7 collision predicate. The
   blocklist tracks the host tokenizer, so it is **closed per platform version**: if the platform later claims a
   text-level token (DOM Parts' `{{ }}`), the blocklist grows and already-registered recipes re-key via config — no
   lexical partition could prevent the overlap. Guarding *only* this slice instantiates
   [registry-name-guard-namespace](platform-decisions.md#registry-name-guard-namespace) (guard the namespace you share
   with the host) and **amends its rule 2** text-node-key exemption for grammar-keyed registries (with lineage).
   Machine-reserved families mint on the ruling that creates their grammar, never pre-reserved here.

7. **Collision predicate — dispatch-key equality + longest-match, injector-scoped** (#2112 Fork 2, ratified
   2026-07-03). Two recipes *collide* (→ **`DelimiterCollisionError`**, built by the #2112 follow-up task) iff they
   share an identical **dispatch key** among the live recipes of **one injector scope**: the key is `open` alone for
   value/marker recipes, **(`open`, `regionName`)** for region recipes (so `{#each}` and `{#ctx}` co-exist). Scanning
   is **longest-match-first** (`{{{` over `{{` over `{`). Scope is resolved hierarchically through the FUI
   `webinjectors` chain (`InjectorRoot.getProviderOf(node, 'customTextNodeParsers')`): **nearest-provider-wins between
   scopes** (a subtree and its app each resolve their nearest registry, deterministic by tree position — sibling
   scopes never collide; this is the general form of delimiter-override, a project / imported component supplying its
   own grammar for its own subtree), **dispatch-key equality within a scope**. This is one registry *type* resolved
   per scope (#2074 Fork 2 "one registry over the surface" preserved), not competing registries. The
   [config-extends-platform-default](platform-decisions.md#config-extends-platform-default) nearest-wins chain
   resolves before liveness, so re-keying a platform-flavor recipe *supersedes* rather than throws.

*Rules 3 (`children:'raw'`), 6, and 7 were added 2026-07-03 by
[#2112](/backlog/2112-reserved-delimiter-family-policy-which-opens-are-platform-re/) (reserved delimiter-family
policy) — reversible extensions of the #2074 spine, with lineage.*

## Directive registration mechanism (#1986) {#directive-registration-mechanism}

**One instance of the general [CustomNode recipe model (#2074)](#custom-node-recipes) above** — the three registries
below are the *polyfill* that materializes delimiter-keyed `CustomNode` kinds onto the native inert containers; the
declarative frame is #2074, this is how FUI builds it.

Ratified 2026-06-30 ([#1986](/backlog/1986-custom-type-registry-family-customtemplatetype-customscriptt/)),
settling the slot rule 5 above left open. Given the #1983 *form*, this is **which registry implements `type=`**.
The mechanism **completes one pattern across the three native inert containers** — `<!-- -->` / `<template>` /
`<script>` — each extended via a discriminator + a `define`/`upgrade`/`whenDefined` registry.

1. **Typed-`<template>` directives register via a minted `CustomTemplateTypeRegistry`** — a **value-space**
   registry whose `upgrade(root)` walk matches `<template>` by its `type` **value** (template-scoped candidate
   set). **Not** `CustomAttribute`: hosting `type=` on the behavior registry keys by attribute *name* (matched
   tree-wide against every `<input/button/script type>`, re-implementing value-dispatch inside one entry) and
   re-merges the two catalogs rule 4's directive-vs-behavior gate splits. `CustomTemplateDirective` / `is=` is
   retired as the directive registration path (the rule 1 forced invariant); behaviors stay on `CustomAttribute`.

2. **Three concrete sibling registries on `HTMLRegistry`, not one parameterized registry.** The family is
   `CustomCommentRegistry` (shipped) / `CustomTemplateTypeRegistry` / `CustomScriptTypeRegistry`, each adding only
   its own `upgrade` walk (`SHOW_COMMENT` walk / `<template type>` value-match / `<script type>` scan). The shared
   shape already lives in the `HTMLRegistry` base, so a god-object `CustomTypeRegistry` would re-implement the base
   and couple three divergent walks behind one surface. **Amendment:** lift the currently copy-pasted
   `whenDefined` + resolver-map up into `HTMLRegistry` so three siblings don't become three copies.

3. **`CustomScriptTypeRegistry` is built now**, absorbing the existing `<script type="injector">` boot-scan
   (`applyDeclarativeInjectors`) as its `upgrade()` — building against a real shipped consumer and deleting the
   bespoke scanner. "No consumer yet" is not a hold (#1620); deferral would only seed a second bespoke scanner.

4. **Capability parity is a requirement, not a fork.** Whichever node a directive rides, it must react to
   sibling-attribute changes on its host (`portal` watches `target`/`disabled`/`required`). This is provided by
   the same `MutationObserver` machinery `CustomAttributeRegistry` already owns — so retiring the `is=` customized
   built-in (which got `attributeChangedCallback` natively) loses no capability.

5. **Family invariant — one region grammar, safe re-claim** (amended by
   [#1989](/backlog/1989-directive-applied-residue-region-annotation-marker-grammar-u/), 2026-07-02). An applied
   directive's region boundaries keep the **authored** open-close grammar (`ns:name` open, leading-`/` close) for
   their whole lifecycle — the same markers the #2063 normative SSR wire format serializes and the client
   re-claims on hydration. There is **no separate reserved residue sigil**: a matcher-excluded grammar for applied
   regions would break hydration, which *requires* applied output to be claimable. Re-upgrade safety is therefore
   not a grammar property: within a document it is claim-state (a registry never re-claims a node it has claimed),
   and across serialization boundaries directive application MUST be **idempotent under re-claim** (rows keyed via
   `data-key`) — a conformance requirement, not implementation trivia. The matcher keeps the single exclusion rule
   that closing markers (leading `/`) sit outside the opening-directive keyspace. Residual: if *anonymous*
   fragment boundaries ever need a marker, the bracket sigil (`<!--[-->`/`<!--]-->`, Vue 3 / Svelte 5 precedent)
   is the reserved slot — a [#2112](/backlog/2112-reserved-delimiter-family-policy-which-opens-are-platform-re/)
   reservation question, not ratified here. (History: the reserved-residue-sigil slot this rule once delegated —
   first to #1987, which punted it back to #1989 — was resolved by #1989 **dissolving** it after #2063/#2068
   converged runtime and SSR output on one grammar; the legacy `:start`/`:end` runtime spelling migrates to the
   standard grammar in #2068.)

6. **Naming + namespace guard.** Base classes (`CustomComment` / `CustomTemplateType` / `CustomScriptType`) extend
   the native nodes; their registries carry the machine-checked `Custom[Name]Registry` suffix. Because
   `<template type>` *values* enter a host-shared DOM namespace (the `type` attribute, where
   `module`/`importmap`/`speculationrules` are platform-reserved on `<script>`),
   `CustomTemplateTypeRegistry.define()` **must** guard its key namespace as `CustomAttributeRegistry` does — the
   precise reserved-token/prefix grammar being the #1987 value-namespacing question.

## Directive operand attribute names (#1993) {#directive-operand-attribute-names}

Ratified 2026-07-01 ([#1993](/backlog/1993-directive-option-attribute-spelling-name-the-template-type-d/)),
extending the directive-form section above. Given the #1983 *form* (`type=` carries directive **identity**) and
#1987's convention (operand sub-attrs are **bare**), this names the per-directive operand role-words. It
**inherits** bare-ness from #1987 — it does not re-decide the separator, only *which bare word* each operand
takes. Unblocks the chunk-4 migration (#1991/#1994).

1. **Operands are role-named per directive** (settled by precedent, not a fork). The operand attribute names the
   operand's **role**, never echoes the directive (`<template type="if" if=…>`) and is never a uniform `expr=`.
   Native universally role-names its operands (`for`/`list`/`value`/`scope`); uniform-naming has zero precedent.
   Native has no conditional/switch/loop, and the framework siblings (Solid `<Show when>`, Lit `choose`) are
   **JSX/JS props, not HTML attributes** — so each word below is a **merit** call, framework spelling as context.

   | Directive | Operand attribute | Example |
   |---|---|---|
   | `if` | **`condition`** | `<template type="if" condition="@state.loggedIn">` |
   | `switch` | **`match`** (discriminant) | `<template type="switch" match="@state.status">` |
   | `for-each` | **`items`** (iterable+alias, fused) + bare **`key`** | `<template type="for-each" items="@users as user" key="@u.id">` |

2. **`condition`** for `<template type="if">` — the literal role-word for a render-time predicate, self-documenting
   for a proposed standard, zero connotation risk. Rejected `when`: imports a **temporal** ("when X happens" →
   event) misread on an inert template, and its lone sibling (Solid) is a JSX prop, not HTML authority.

3. **`match`** for `<template type="switch">` — role-accurate ("the value to match against the cases") and pairs
   with the inner `case` (`match`↔`case`). Rejected `value`: `<option value>` is a form **payload** on the
   *option* (= the case-equivalent), so its own precedent authorizes `value` on the `case`, not the discriminant.
   `on` is a defensible runner-up (the `on:click` collision fear is void — events are colon-namespaced) but loses
   to `match` on role-clarity. Inner branch words `case` / `default` were already settled (#1986-era, shipped).

4. **`for-each` keeps the fused microsyntax** `items="@users as user"` (iterable+alias in one value, parsed by
   the shipped `AS_REGEX`) plus a separate bare **`key`**. Every web framework (Vue/Angular/Svelte/Solid/Alpine)
   fuses iterable+alias, so chunk-4 only re-homes identity to `type=` and renames the carrier to `items`. Rejected
   the split (`items`/`as`/`key`): it would invent a zero-prior-art lone `as="user"` (meaningless without its
   source) and rewrite working, cross-framework-aligned code — native has no iteration to anchor an "attribute
   values are single values" analogy, so the *closest existing shape* is the microsyntax, not a hypothetical split.

## What this home does *not* cover

The three governance areas this schema reference sliced out — **lifecycle** (#1092), **taxonomy** (#1093),
and **composability** (#1094) — are now all authored in the sections above. Deeper future enforcement (the
unresolved-ref / acyclicity / implements-uniqueness gates noted above) is tracked as its own follow-up
slice, not in this doc.
