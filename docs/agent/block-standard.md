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
7. **Per-block mechanism selection — the decision rule (#1381).** Within the default **S1** strategy, pick a
   block's runtime family by what its *primary* consumer needs, not by effort. Ratified by
   [#1381](/backlog/1381-button-packaging-pick-runtime-shape-mechanism-transient-vs-p/) (2026-06-21), the
   button as the worked example (→ **transient**):
   - **Behavior-free presentational control** (button, badge, …) → **(A) transient self-erase → native**. The
     reference shape. Behaviors ride `CustomAttribute`s on the *surviving* native element, which carry the
     full lifecycle (observe-attribute, connect/disconnect, form participation) — so attribute-shaped
     reactivity and native events are **kept**; only **imperative non-serializable property writes on a
     persistent element ref** are given up (and for these blocks that surface is near-empty).
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
     ([#1456](/backlog/1456-grouped-form-control-packaging-mechanism-transient-a-vs-pers/)):* a **single**
     control (single checkbox, text-field, number-input) → **(A)** transient → native `<input>`; a
     **grouped** control (checkbox-group, radio-group) → **(B)** persistent light-DOM, because the group's
     composite `value`/`values` is a live two-way-binding surface and a group has no native single-element
     to erase into.
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
     irreplaceable-native blocks emit native; the statute bars (no load-bearing `is=`; single-substrate floor;
     MaaS serves only platform-correct variants).
   - **CONFIGURABLE** (per-project, **platform-correct variants only**): transient ↔ persistent light-DOM for
     soft / replicable blocks, and which sanctioned variant the configurator/MaaS assembles — native-first
     **default**, alternative **opt-in**. A **substrate swap** (a load-bearing non-standard shim like polyfilled
     `is=`) is **never** configurable.
   - **FREEDOM** (the dev's call): which mechanism per case, from the catalog/matrix with pros/cons.
4. **`is=` is not a WE mechanism.** Every job is dominated — load-bearing native output → **transient**; behaviour
   on an authored element → **`CustomAttribute`** (in-place, cross-browser, single-substrate — beats `is=` on every
   axis); persistent live instance → **(B)**; foreign in-place → no real need. WE documents `is=` **only as an
   opt-in developer option** (polyfill in FUI, enabled by explicit dev choice; lower-compliance, §7-spectrum) —
   never a block mechanism, never default.
5. **Per-layer native/plug + plug-to-direction.** Decompose a capability: a layer **present** in a shippable
   browser → **native** (emit-to-native / transient — never polyfill what already ships); a layer **absent** from
   every spec → **plug**, riding the transient survivor as a `CustomAttribute`. Author each plug to align with its
   **standards-track candidate** (DOM Parts `ChildNodePart`; `ElementInternals.type` #11061; the WC-CG Context
   Protocol; the signals proposal; `moveBefore()`) so it **deprecates + migrates to native** when the standard
   ships.
6. **Behaviour vs directive — behaviour is first-choice.** `CustomAttribute` (decorate a *connected* element) is
   the default; a comment-anchor **directive** is the exception, for **pre-connection / region control** only —
   gating *whether* an element connects (`ViewIf`), *how many times* (`ForEach`), or transforming a region before
   its contents upgrade. A behaviour attaches *after* its element connects, so it cannot prevent/multiply that
   connection — only a directive can.
7. **Per-case verdicts** (full matrix in #1963): cases 4/5, 7 ✅; cases 2, 3, 6, 9 ◐ (named confirms — **case 6 is
   strongest via the Context Protocol**, zero-node DI; `webinjectors` #1044 aligns to it); case 1 → **#1962** (the
   transient-vs-wrapper mechanism rule). **Case 8 is covered** (`is=` jobs all dominated; the owned-element
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

## Directive registration mechanism (#1986) {#directive-registration-mechanism}

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

5. **Family invariant — authored vs residue grammars are disjoint and matcher-excluded.** Authored directive
   nodes and the region/residue annotations a directive *leaves when applied* must occupy non-overlapping
   grammars, so every registry's `upgrade` walk claims **only authored nodes** (residue is never re-upgraded — cf.
   the leading-`/` exclusion that already keeps closing markers out of the opening-directive keyspace) and the two
   are visually distinguishable in raw DOM / devtools. The **exact reserved residue sigil** (unifying today's
   `:start`/`:end` vs `/`-close split) is a token-grammar question delegated to
   [#1987](/backlog/1987-attribute-naming-convention-review-colon-namespacing-view-if/).

6. **Naming + namespace guard.** Base classes (`CustomComment` / `CustomTemplateType` / `CustomScriptType`) extend
   the native nodes; their registries carry the machine-checked `Custom[Name]Registry` suffix. Because
   `<template type>` *values* enter a host-shared DOM namespace (the `type` attribute, where
   `module`/`importmap`/`speculationrules` are platform-reserved on `<script>`),
   `CustomTemplateTypeRegistry.define()` **must** guard its key namespace as `CustomAttributeRegistry` does — the
   precise reserved-token/prefix grammar being the #1987 value-namespacing question.

## What this home does *not* cover

The three governance areas this schema reference sliced out — **lifecycle** (#1092), **taxonomy** (#1093),
and **composability** (#1094) — are now all authored in the sections above. Deeper future enforcement (the
unresolved-ref / acyclicity / implements-uniqueness gates noted above) is tracked as its own follow-up
slice, not in this doc.
