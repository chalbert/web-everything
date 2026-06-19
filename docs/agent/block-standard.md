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
| `Directive` | A template/comment directive that transforms markup at stamp time. | The block is a `<template is=…>` / `<!-- … -->` directive. | `extendsClass: CustomTemplateDirective` (or `CustomComment`). |
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

## What this home does *not* cover

The three governance areas this schema reference sliced out — **lifecycle** (#1092), **taxonomy** (#1093),
and **composability** (#1094) — are now all authored in the sections above. Deeper future enforcement (the
unresolved-ref / acyclicity / implements-uniqueness gates noted above) is tracked as its own follow-up
slice, not in this doc.
