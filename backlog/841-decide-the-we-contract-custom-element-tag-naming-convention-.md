---
type: decision
workItem: story
size: 3
parent: "746"
status: resolved
relatedProject: webdocs
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: none
crossRef: { url: /backlog/822-enrich-block-cem-with-tagname-attributes-properties-slots-so/, label: "CEM surface ruling (#822)" }
relatedReport: reports/2026-06-17-custom-element-tag-naming-convention.md
preparedDate: "2026-06-17"
tags: [webdocs, cem, blocks, naming, jsx, registration]
---

# Decide the WE contract custom-element tag naming convention (element-ness opt-in; regular prefix+id vs per-entry; deep-JSX stays totally flexible)

**Prepared 2026-06-17 — ready to ratify.** No design existed for the `tagName` *value* before this. The
two forks below are grounded in a prior-art survey published as the
[`custom-element-tag-naming-convention`](/research/#custom-element-tag-naming-convention) research topic
(session report linked via `relatedReport`), each carrying a recommended default in **bold**. The survey
**reshaped the framing**: it added a forced element-ness fork the original single either/or buried, and
demoted the prefix string from a fork to a configurable default.

[#822](/backlog/822-enrich-block-cem-with-tagname-attributes-properties-slots-so/) ruled the custom-element
surface is a **WE-owned contract** (FUI conforms; impl-is-not-a-standard + the polyglot vision #463). This
sibling decides what `tagName` **value** WE specifies — gating the value-authoring half of the #822 build
(the `gen-cem` projection half is value-agnostic and already unblocked).

## Ruling (ratified 2026-06-17)

Both forks ratified as recommended, with the discussion's refinements:

1. **Fork 1 — element-ness: A (opt-in/authored), ~90%.** A block declares element-ness explicitly (carries
   `tagName`); never derived from `type`. Element-ness is orthogonal to `type` (the 7 real elements straddle
   `Component` and `Module`), so auto-derive is broken both ways (fabricates + misses). A block declares 0/1/N
   element tags. Aligns with CEM's declared-not-inferred semantics (#653).
2. **Fork 2 — value: A (regular derivable `<prefix>-<id>`), ~85%** (raised from ~75% by the override-layer
   split). WE's contract value is *purely* the derivation; prefix default `we-` (configurable
   Config-Extends-Platform-Default; `fui-` excluded). The one WE-*authored* value is the structurally-
   underivable N-tag block (`router` → `route-view` + `route-outlet`).
3. **Parameterized-registration invariant.** The impl registers `registerX(tag = <contract-default>)`, never a
   hard-coded literal; the override hatch lives **consumer-side** (JSX/scoped-registry, MaaS, project config),
   not as a WE-contract exception. The gate (#844, extending #783 Check-2) validates the *default arg* equals
   the spec and that no element hard-codes a literal; a consumer override is allowed, not a failure.
4. **Binds only global-registration modes** (invariant from #822); compile/JSX/DI naming stays free.

**Downstream (now unblocked):** #843 (gen-cem authors the value; carries the (a)/(b) authoring sub-shape +
multi-tag data-model), #844 (the FUI conformance gate). Rule home = `we:docs/agent/conventions.md`.

## Axis-framing — what the real tree forces

Today **no block carries a `tagName`** and `gen-cem.mjs` emits a custom-element declaration only when one is
present, **never fabricating** ([we:scripts/gen-cem.mjs:68-80](scripts/gen-cem.mjs#L68-L80)). The survey of the
tree decomposes the value question into two orthogonal axes plus a configurable dimension:

- **Element-ness** (Fork 1). Of 75 blocks, only **7 custom *elements*** actually register in FUI via
  `customElements.define` — `auto-heading`, `auto-complete`, `route-view`, `route-outlet`, `background-tasks`,
  plus `page-nav` (pagination) and `data-table`, the last two via parameterized `register*(tag = 'default')`
  functions (`fui:blocks/renderers/pagination/PaginationBehavior.ts:173-175`,
  `fui:blocks/renderers/data-table/DataTableBehavior.ts:101-103`). **Element-ness is orthogonal to `type`:** the 7
  split across `type:Component` (`autocomplete`, `router`, `background-task-surface`) **and** `type:Module`
  (`transient-component`, `pagination`, `data-table`), while most Components register instead as
  behaviors/attributes/functions (`tabs` → attributes, `stepper` → `registerStepper`, `tree-select` →
  `registerTreeSelect`). So a tag **cannot** be inferred from `type` either way — auto-derive-from-type both
  fabricates fictional `<tabs>`/`<stepper>` (false positive) **and** misses the Module-typed elements (false
  negative). And a block is not 1:1 with a tag — the single `router` block registers **two** elements
  (`route-view` + `route-outlet`); `autocomplete`→`auto-complete`, `transient-component`→`auto-heading`,
  `pagination`→`page-nav` show tag ≠ id ([we:src/_data/blocks.json](src/_data/blocks.json);
  `fui:blocks/router/registerRouter.ts:33-36`).
- **Value-default posture** (Fork 2). FUI's 7 tags are bare kebab with **no `fui-` prefix anywhere**; **24
  single-word ids** (`dropdown`, `menu`, `dialog`, …) are **invalid as bare custom-element tags** (WHATWG
  requires a hyphen), so a uniform prefix mechanically guarantees validity catalog-wide. The ecosystem
  converges on one short namespace prefix per library (`sl-`/`md-`/`sp-`/`fluent-`/`ion-`/`lightning-`).
- **Prefix string** (configurable, *not* a fork). Both fixed and project-configurable are coherent → a
  Config-Extends-Platform-Default setting; `we-` is the platform default, `fui-` is excluded (it would brand
  the WE-owned contract with the impl name). See *Supported by default*.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — element-ness | **Opt-in / authored** — a block declares it's a custom element; never auto-derived from `type` | Auto-derive a tag from `type:Component` (**broken**: fabricates `<tabs>`/`<stepper>` AND misses Module-typed elements) | High (~90%) |
| 2 — value posture | **Regular derivable convention** `<prefix>-<id>`; FUI's 7 names migrate to conform; override is **consumer-side** (parameterized registration), not a WE-contract exception | Per-entry authored value, ratifying FUI's existing names as-is | High (~85%) |

## Fork 1 — element-ness: opt-in/authored vs auto-derived from `type:Component`

*Fork-existence (case a, flawed branch named):* auto-deriving a tag from `type` is **broken in both
directions** — most Components register as behaviors/attributes/functions, not `customElements.define` (so
auto-derivation fabricates fictional `<tabs>`/`<stepper>` FUI never registers), **and** three of the 7 real
elements are `type:Module` not Component (so a Component-gated rule would miss `pagination`/`data-table`/
`transient`). Either way it violates `gen-cem`'s never-fabricate invariant
([we:scripts/gen-cem.mjs:68-80](scripts/gen-cem.mjs#L68-L80)).

- **A — Opt-in / authored (recommended).** A block declares element-ness explicitly (carries a custom-element
  marker / `tagName`); only the 7 genuine elements get declarations. The *value* still defaults via the
  Fork-2 derivation rule once opted in. The data model lets one block declare **0, 1, or N** element tags
  (so `router` → `route-view` + `route-outlet`). Matches CEM's module→many-declarations model and `gen-cem`'s
  existing "no tag fabricated" guard.
- **B — Auto-derive for every `type:Component`.** *Rejected* — fabricates tags for non-element Components;
  contradicts the tree and the never-fabricate invariant.

**Recommended default: A (opt-in element-ness).** Confidence ~90%; residual is purely the data-model shape
for multi-tag blocks (a `tagName` list / multiple element declarations per block), a #822 build detail.

## Fork 2 — value-default posture: regular derivable convention vs per-entry authored

*Fork-existence (case b, genuine either/or):* a contract has exactly **one** default posture — it either
*derives-and-migrates* (WE pins `<prefix>-<id>`, FUI's irregular names migrate to conform) or
*authors-and-ratifies* (WE hand-writes each value, keeping FUI's good names). Both produce a valid contract;
they cannot both be the default. The override hatch exists in either, so the real call is which way the
default leans and whether FUI's 7 names migrate.

- **A — Regular derivable convention (recommended).** WE specifies `<prefix>-<id>` (prefix default `we-`,
  see *Supported by default*); a block's tag defaults to the derived value; FUI's 7 element names
  (`auto-complete`/`auto-heading`/`route-view`/`route-outlet`/`background-tasks`/`page-nav`/`data-table`)
  **migrate to conform** (FUI is the conformer, not the source — the #463 standard→impl drift direction,
  gated by #783's Check-2). Predictable, derivable
  (a .NET/Java forward-adapter can *generate* the tag deterministically — #463/#505/#507), and the prefix
  mechanically fixes all 24 single-word ids. Authored per-entry override is allowed **only where the regular
  scheme is genuinely wrong** for a block — never as deferring to FUI as the source.
- **B — Per-entry authored, ratify existing.** WE hand-authors every tagName; where FUI already has a good
  name (`route-view`) WE *ratifies* it into the contract. No FUI churn, hand-tuned names. *Con:* not
  derivable — a consumer/forward-adapter can't predict the tag; no mechanical rule; loses the validity
  guarantee for single-word ids (each needs a hand-picked hyphenated value).

**Recommended default: A (regular derivable convention; override is consumer-side, not a WE-contract
exception).** Confidence **~85%** (raised from ~75% by the override-layer split below). Red-team: the decider
should argue B by pointing at readability — `we-autocomplete` reads worse than the hand-picked
`auto-complete`, and `we-pagination` loses the genuinely-semantic `page-nav`; A imposes a real (if small,
~7-name) FUI migration. The default holds because derivability is load-bearing for the polyglot
forward-adapter vision and the prefix is the only scheme that makes the 24 single-word ids valid without
per-entry hand-work.

**The override hatch lives in the consumer layer, not the WE contract (refinement, ratified in discussion).**
The earlier "WE authors a per-entry override where the derived name is wrong" hatch is **relocated**: the WE
contract value is *purely* the derivation `<prefix>-<id>` (no per-entry pretty-name exceptions polluting it),
and a use-site that wants a different tag — JSX/scoped-registry, MaaS per-tenant, project config — overrides
it *at registration* (see the parameterized-registration invariant in *Supported by default*). So
`page-nav`/`auto-heading` are no longer WE-contract values that argue toward B; they become optional
consumer overrides, and the contract stays cleanly derivable. The **one** value WE still *authors* (not
derives) is the structurally-underivable N-tag block: `router` → `route-view` + `route-outlet`, because scalar
`we-<id>` can't express two tags — that's the authored form of the default for an N-tag block, not an
override. Residual is the FUI migration churn (5 hard-coded registrations → parameterized) and whether
consumers override so often the portable default goes unused — both minor.

## Worked examples — the convention applied to the real catalog

### Fork 1 — why auto-derive-from-`type` fabricates (and misses)

Of **39** `type:Component` blocks, only **3** register a custom element. Auto-derive-from-`type:Component`
(branch B) would emit a CEM `custom-element` declaration for all 39 — fabricating ~36 fictional tags FUI
never registers — **and** still miss the 3 `type:Module` elements. Opt-in (1A) emits exactly the 7 real ones.

| block id | `type` | registers a custom element? | auto-derive-from-`type:Component` (B) | opt-in (1A) |
|---|---|---|---|---|
| `autocomplete` | Component | ✓ `auto-complete` | ✓ emits | ✓ emits (authored) |
| `tabs` | Component | ✗ — `TabListAttribute`/`TabTriggerAttribute` | ✗ **fabricates `<tabs>`** (false +) | — correctly silent |
| `stepper` | Component | ✗ — `registerStepper` (function) | ✗ **fabricates `<stepper>`** (false +) | — correctly silent |
| `tree-select` | Component | ✗ — `registerTreeSelect` (function) | ✗ **fabricates `<tree-select>`** (false +) | — correctly silent |
| `pagination` | **Module** | ✓ `page-nav` | ✗ **misses it** (false −) | ✓ emits (authored) |
| `data-table` | **Module** | ✓ `data-table` | ✗ **misses it** (false −) | ✓ emits (authored) |

A block declares element-ness by carrying `tagName` (the marker `gen-cem` already keys on,
[we:scripts/gen-cem.mjs:167](scripts/gen-cem.mjs#L167) `isCustomElement = Boolean(b.tagName)`); the data model
allows **0, 1, or N** declarations — `tabs` carries none, `autocomplete` one, `router` two
(`route-view` + `route-outlet`). The value of each declared tag is then set by Fork 2.

#### Concretely, how opt-in flows — author → gen-cem → gate

Three layers, grounded in the code as it is today:

1. **Author opts in, in `we:src/_data/blocks.json`.** This file is the ratified **CEM-aligned canonical
   block-protocol shape** (#641 Fork-1 → #657 resolved: "no new schema; extend the surface that already
   exists"), and `gen:cem` projects its contract subset into the distribution artifact `custom-elements.json`
   (#653, CEM registered as a WE protocol; website-only fields like `fuiDemo`/`summary` stay out of the CEM).
   So `tagName` fills a slot in the standard's pinned shape — not a website-only field. Today every entry is
   element-less (no `tagName`); opting `autocomplete` in is a one-field edit — the block declares it commits a
   global tag:
   ```jsonc
   { "id": "autocomplete", "type": "Component",
     "tagName": "auto-complete",   // ← the opt-in marker; absent = not a custom element
     "summary": "…", "attributes": [...], "slots": [...] }
   ```
   **Where the Fork-2 value comes from is a sub-shape for the #822 build:** either (a) the author writes the
   full string literally (`"tagName": "we-autocomplete"`), with the `we-<id>` convention enforced by a
   `check:standards` lint + the override hatch for irregulars; or (b) the author writes a boolean marker
   (`"element": true`) and `gen-cem` *computes* `tagName = <prefix>-<id>`, with an explicit `tagName` only as
   an override. **2A's "derivable" property favors (b)** — derivation as a tool rule (not a hand-typed
   literal) is what lets a .NET/Java forward-adapter regenerate the tag deterministically (#463/#505/#507).
   Either way the authored field is the opt-in; (a)/(b) is the build's call, flagged here.

2. **`gen-cem` projects it (already wired for the single-tag case).** `cemModule`
   ([we:scripts/gen-cem.mjs:164-194](scripts/gen-cem.mjs#L164-L194)) emits `customElement: true` + `tagName`
   the moment the field is present — nothing new for `autocomplete`. **The one real build change is multi-tag:**
   `cemModule` today emits exactly **one** declaration keyed on a *scalar* `b.tagName`, so `router` (1 block →
   `route-view` + `route-outlet`) is not yet representable. The #822 build widens `tagName` to accept a list /
   per-element entries and emits N declarations. This is the "data-model shape" residual Fork 1A names.

3. **The gate enforces FUI conforms (filed against #783 Check-2, not here).** Once `autocomplete` carries
   `"tagName": "auto-complete"`, Check-2 asserts FUI's `customElements.define('auto-complete', …)`
   (`fui:blocks/droplist/AutoComplete.ts:444`) matches the WE-spec value — and **fails** if FUI drifts.
   That is the #463 standard→impl direction (WE is the source; FUI conforms), the inverse of WE mirroring FUI.

### Fork 2 — the value, once a block has opted in

**The 7 elements that exist today** (derive `we-<id>`, then resolve migrate-vs-override). Shows the real
texture of Fork 2: only ~3 of 7 derive sensibly; the rest are FUI's hand-picked semantic names.

| block id | `type` | derived `we-<id>` | FUI current | resolution under 2A |
|---|---|---|---|---|
| `data-table` | Module | `we-data-table` | `data-table` | **clean migrate** — id == name, just gains the prefix |
| `autocomplete` | Component | `we-autocomplete` | `auto-complete` | migrate (derived is valid, just less pretty) — or override |
| `background-task-surface` | Component | `we-background-task-surface` | `background-tasks` | migrate (verbose) — or override to `we-background-tasks` |
| `pagination` | Module | `we-pagination` | `page-nav` | **override** — `page-nav` is a genuinely better semantic name |
| `transient-component` | Module | `we-transient-component` | `auto-heading` | **authored** — tag ≠ id at all; `auto-heading` names what it does |
| `router` | Component | — | `route-view` + `route-outlet` | **authored multi-tag** — 1 block → 2 elements, derivation N/A |

So on the only real data we have, the override/authored rate is **high (~4 of 7)** — the residual Fork 2's
red-team names, now concrete. It does **not** sink 2A: these 7 are FUI's *legacy* hand-picked set; the rule
earns its keep on the **rest of the catalog**, where derivation gives a free valid tag the moment a block
opts in (next table). The override hatch is doing exactly its job on the legacy names.

**The validity win** — of 26 single-word ids, none is a valid bare custom-element tag (no hyphen); `we-`
mechanically fixes every one, so any future opt-in derives a valid tag with zero hand-work:

| block id | bare tag valid? | derived (opt-in → `we-<id>`) |
|---|---|---|
| `dropdown` | ✗ no hyphen | `we-dropdown` ✓ |
| `dialog` | ✗ | `we-dialog` ✓ |
| `menu` | ✗ | `we-menu` ✓ |
| `tooltip` | ✗ | `we-tooltip` ✓ |
| `checkbox` | ✗ | `we-checkbox` ✓ |
| `carousel` | ✗ | `we-carousel` ✓ |

(Multi-word ids already carry a hyphen, so they derive clean with or without the prefix: `date-picker` →
`we-date-picker`, `tree-select` → `we-tree-select`, `segmented-control` → `we-segmented-control`.)

## Supported by default (not decisions)

- **Registration is parameterized (tag = contract-default), never a hard-coded literal (ratified invariant).**
  The WE contract value is the **default argument** of the impl's register function — `registerAutoComplete(tag
  = 'auto-complete')` — exactly the shape FUI already uses for `registerPagination(tag = 'page-nav')` /
  `registerDataTable(tag = 'data-table')`. The other 5 element registrations FUI **hard-codes** the literal in
  `customElements.define('auto-complete', …)` (`fui:blocks/droplist/AutoComplete.ts:444`,
  `fui:blocks/router/registerRouter.ts:33-36`, `fui:blocks/transient/registerTransient.ts:23`,
  `fui:blocks/background-task-surface/registerBackgroundTasks.ts:23`) — they **migrate to the parameterized
  shape** (the doc-comments at `fui:blocks/router/registerRouter.ts:27` /
  `fui:blocks/background-task-surface/registerBackgroundTasks.ts:18` already show the intended
  `app-view`/`app-tasks` customizability, never wired). This is what lets a use-site **override the tag** —
  JSX/scoped-registry, MaaS per-tenant, project config — without forking the contract. The conformance gate
  (#783 Check-2) validates the **default arg equals the WE-spec value** and that no element hard-codes a
  literal; an explicit override passed by a consumer is allowed and is **not** a conformance failure. Where
  the register code lives in FUI is an impl detail (not specified by WE).
- **The prefix is a configurable Config-Extends-Platform-Default value, not a pick-one fork.** Both "fixed
  `we-`" and "project-configurable" are coherent end-states → support both: the derivation rule reads a
  prefix from the platform config; the platform **default is `we-`** (aligns with the `@webeverything` npm
  scope — the standard layer's namespace); a design-system project (parent [#746](/backlog/746/))
  overrides it (`acme-`). The resolved prefix is **pinned per project**, so a static-HTML doc stays portable
  across that project's impls (the impl-swap constraint #822 named). `fui-` is **excluded** — branding the
  WE-owned contract tag with the impl name inverts the constellation. Graduates one Technical Configurator
  card (the tag-prefix platform setting) at build time.
- **The convention binds ONLY global-registration modes (ratified invariant, from #822).** Static-HTML /
  global `customElements.define` / impl-swap consult the contract tag. Deep compile-time / JSX `<component>`
  consumption and the DI-replace-a-component case **never materialize a runtime global tag**, so naming there
  stays totally flexible (most-flexible-default; the platform's scoped-custom-element-registry proposal is
  the analog). The naming rule is the floor for the global modes, never a project-wide mandate.

---

## Context

- **Home for the rule:** the eventual ruling adds a tag-naming clause to
  [we:docs/agent/conventions.md](docs/agent/conventions.md) (WE's canonical naming authority, machine-checked by
  `check:standards`), alongside the existing trait/registry/behavior-attribute conventions.
- **Build split (from #822):** (a) extend `gen-cem`'s `cemModule` to project `tagName`/`attributes`/`members`/
  `slots` — value-agnostic, already unblocked; (b) author the `tagName` **values** — `blockedBy` this
  decision. The multi-tag data-model shape (one block → N element declarations, per `router`) is decided in
  the #822 build, informed by Fork 1A.
- **Conformance direction:** the gate is *FUI conforms to WE* (extend #783's Check-2 so every FUI
  `customElements.define` name equals the WE-spec `tagName`), not WE mirroring FUI — the #463 standard→impl
  drift direction. Filed against the #783 Check-2 build, not here.
- **Scope:** only blocks that register a custom element get a `tagName`; custom *attributes* (`on:click`,
  `nav:list`, `grid:*`) stay plain `class` declarations (#822 scope).
