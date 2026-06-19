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

## What this home does *not* cover

The deeper governance prose for each area is authored in its own sliced item, hanging off this schema
reference: **lifecycle** semantics + transitions (#1092), **taxonomy** of the six types + when to pick
which (#1093), and **composability** rules — implements-vs-composes, trait/dimension discipline (#1094).
