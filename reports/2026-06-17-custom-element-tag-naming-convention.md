# Custom-element tagName naming convention — prep research (#841)

**Date:** 2026-06-17 · **Decision:** [#841](/backlog/841-decide-the-we-contract-custom-element-tag-naming-convention-/) · **Parent:** [#746](/backlog/746-block-explorer-interactive-fui-block-workbench/) · **Gated build:** [#822](/backlog/822-enrich-block-cem-with-tagname-attributes-properties-slots-so/) (the `tagName`-value authoring)

## Why this decision exists

[#822](/backlog/822-enrich-block-cem-with-tagname-attributes-properties-slots-so/) ruled that the
custom-element surface (tagName + attributes/properties/slots) is a **WE-owned contract**, and FUI is one
implementation that must conform to it (impl-is-not-a-standard + the #463 polyglot/forward-adapter vision).
That ruling **dissolved** the "where does the surface live" fork but explicitly carved out the *one genuine
remaining call*: **what `tagName` value WE specifies**. #841 is that sibling. It gates the `tagName`-value
authoring half of #822's build (the `gen-cem` projection half is value-agnostic and already unblocked).

The decision binds **only** the global-registration modes (static-HTML / global `customElements.define` /
impl-swap). Deep compile-time / JSX consumption never materializes a runtime global tag, so naming there
stays totally flexible — an invariant #822 already fixed (most-flexible-default), carried forward here.

## The tree as it actually is

### No block carries a `tagName` today

`fui:src/_data/blocks.json` (75 blocks) has **zero** `tagName` fields. `we:gen-cem.mjs` emits a CEM
`custom-element` declaration (`customElement: true` + `tagName`) **only** when a block carries an explicit
`tagName`, and **never fabricates** one ([we:scripts/gen-cem.mjs:68-80](scripts/gen-cem.mjs#L68-L80) — "no tag
is ever fabricated — `registryName` is a DI registry class name, NOT a custom-element tag"). So today
`gen:cem` emits 0 custom-element declarations. This decision authors the values that turn that on.

### Most `type:Component` blocks are NOT custom elements

This is the load-bearing finding. Of the 75 blocks, many `type:Component` entries do **not** register a
custom element — they register as **behaviors / attributes / functions**: `tabs` → `TabsComponent` +
`TabListAttribute`/`TabTriggerAttribute` (attributes), `stepper` → `registerStepper`, `tree-select` →
`registerTreeSelect`, `master-detail` → `MasterDetailBehavior`. Surveying FUI
(`/Users/nicolasgilbert/workspace/frontierui`), **7 custom *elements* are actually registered via
`customElements.define`** (the prep grep missed `page-nav`/`data-table`, which register via a parameterized
`register*(tag = 'default')` function — corrected here):

| FUI tag | kind | block id | block `type` | FUI file:line |
|---|---|---|---|---|
| `auto-heading` | element | `transient-component` | Module | we:blocks/transient/registerTransient.ts:23 |
| `auto-complete` | element | `autocomplete` | Component | fui:blocks/droplist/AutoComplete.ts:444 |
| `route-view` | element | `router` | Component | we:blocks/router/registerRouter.ts:33 |
| `route-outlet` | element | `router` | Component | we:blocks/router/registerRouter.ts:36 |
| `background-tasks` | element | `background-task-surface` | Component | fui:blocks/background-task-surface/registerBackgroundTasks.ts:23 |
| `page-nav` | element | `pagination` | Module | we:blocks/renderers/pagination/PaginationBehavior.ts:173-175 |
| `data-table` | element | `data-table` | Module | we:blocks/renderers/data-table/DataTableBehavior.ts:101-103 |

Everything else FUI registers via `attributes.define` (`type-ahead`, `for-each`, `nav:list`, `nav:section`,
`grid:cell-navigation`, `grid:cell-edit`, `route:link`, `route:prefetch`) is a **custom attribute**, not a
custom element — #822 already scoped those out (they stay plain `class` declarations, no tagName). FUI's
`fui:blocks.json` carries the names under a `registeredNames` array per entry.

Two structural facts fall out, and both reshape the fork:

1. **Element-ness is sparse and orthogonal to `type` — cannot be inferred from it either way.** The 7
   elements straddle `type:Component` (autocomplete/router/background-task-surface) **and** `type:Module`
   (transient/pagination/data-table). Auto-deriving a tag for every `type:Component` block both fabricates
   fictional `<tabs>`/`<stepper>` elements FUI never registers (false positive) **and** misses the
   Module-typed elements (false negative) — violating `gen-cem`'s never-fabricate invariant either way.
   Element-ness must be **authored / opt-in** per block.
2. **A block does not map 1:1 to a tag.** `router` (one block) registers **two** elements
   (`route-view` + `route-outlet`); `autocomplete`→`auto-complete`, `transient-component`→`auto-heading` and
   `pagination`→`page-nav` show tag ≠ id. So a pure 1:1 "prefix + id" derivation is structurally impossible — the data model must
   allow a block to declare **0, 1, or N** element tags, and the value must be **overridable**.

### FUI's element names are regular-ish but un-prefixed; `fui-` does not exist

The 7 element tags are all **bare kebab-case with no vendor prefix** (`auto-heading`, `route-view`, `page-nav`, …).
There is **no `fui-` prefix anywhere** in the tree. #822's hypothetical `fui-<id>` is therefore contrary to
both FUI's real practice and the constellation (a `fui-` prefix would brand the WE-owned contract tag with
the implementation's name — a category error by #822's own logic). The realistic prefix options are `we-`,
some neutral/configurable value, or none.

### 24 single-word ids are invalid as bare tags

Per the WHATWG HTML "valid custom element name" production, a custom element name **must contain a hyphen**,
start with a lowercase ASCII letter, and avoid the reserved hyphenated names (`annotation-xml`,
`color-profile`, `font-face`, `font-face-src`, `font-face-uri`, `font-face-format`, `font-face-name`,
`missing-glyph`). 24 component-type block ids are single-word and **invalid as bare tags**: `dropdown`,
`menu`, `dialog`, `drawer`, `carousel`, `checkbox`, `tooltip`, `slider`, `breadcrumb`, `tabs`, `stepper`,
`router`, `workflow`, `temporal`, `reaction`, `notification`, `form`, `pagination`, `view`, `selection`,
`broadcast`, `wizard`, … A **prefix mechanically guarantees a hyphen** for all of them, so a uniform
prefix is not merely cosmetic — it is what makes the derivation rule valid across the whole catalog without
per-entry renaming.

### WE already has a convention authority + a config-extends-default discipline

[we:docs/agent/conventions.md](docs/agent/conventions.md) is the canonical naming authority for **both** WE and
FUI, machine-checked by `check:standards` (traits `with*`, registries `Custom*Registry`, behavior
attributes colon-namespaced like `layout:grid`). A tag-naming rule belongs here as a new clause. Separately,
WE's standing **Config-Extends-Platform-Default** discipline (memory; `core CustomRegistry extends`) says a
default value lives in the *platform config a project extends*, with the core staying default-less — directly
relevant to whether the tag prefix is a fixed constant or a configurable platform-default.

## Prior art — how the ecosystem names custom-element tags

The web platform mandates only the *shape* of a valid name (hyphen-required, lowercase-start, reserved-name
denylist — WHATWG HTML §"custom element name"); it imposes **no** prefix policy and **no** id→tag mapping.
WAI-ARIA APG / MDN say nothing about tag *names* (they govern roles/behavior, not element identifiers). So
the naming convention is a project policy, and the prior art is the **component-library ecosystem**, which
has strongly converged on **one short vendor/namespace prefix per library** to guarantee the hyphen and
avoid global-registry collisions:

| Library | Prefix | Example |
|---|---|---|
| Shoelace / Web Awesome | `sl-` / `wa-` | `<sl-dropdown>` |
| Material Web | `md-` | `<md-checkbox>` |
| Adobe Spectrum | `sp-` | `<sp-button>` |
| Microsoft Fluent | `fluent-` | `<fluent-dialog>` |
| Ionic | `ion-` | `<ion-button>` |
| Salesforce Lightning | `lightning-` / `c-` | `<lightning-button>` |

Two further platform facts:

- **Custom Elements Manifest** (the format WE ratified as a protocol, #626) resolves a tag name from the
  `customElements.define('x-foo', …)` call string, **never** from filename/dirname — confirming the tag is an
  authored value distinct from the module/block id. The manifest models a module emitting **many**
  declarations, matching the router→2-elements reality.
- **Scoped custom-element registries** (the `ElementInternals` / scoped-registry proposal, shipping behind
  flags) let a tag bind locally instead of globally — the same insight #822 encoded as "deep JSX consumption
  dissolves the runtime global tag." The convention governs the **global** registration mode; scoped/compile
  consumption is the always-free path.

**Verdict from prior art:** a short uniform prefix + the component's kebab name is the dominant, predictable,
collision-safe scheme; the prefix is a per-library namespace. For WE the namespace is the **standard** (`we-`,
aligning with the `@webeverything` npm scope), not the impl (`fui-`). The id→tag map is authored (opt-in
element-ness, override for multi-element/irregular blocks), exactly as CEM models it.

## How the research reshaped the forks

The item came in (via #822's carve-out) framed as a single either/or: *"derivable regular convention
(prefix+id) vs WE authoring a per-entry value."* The survey splits that into two orthogonal questions and
adds a configurable-dimension layer the framing omitted:

1. **Element-ness opt-in (NEW, forced by evidence).** Because most `type:Component` blocks aren't custom
   elements and a block can register N tags, "derive a tag from every Component" is **broken** (fabrication).
   This becomes Fork 1 with a named broken branch — a forced ratify the original framing buried inside
   "prefix+id."
2. **The value-default posture (the original fork, sharpened).** Regular derivable convention + migrate FUI's
   5 names to conform **vs** per-entry authored + ratify FUI's existing names. Genuine either/or (a contract
   has one default posture). Fork 2.
3. **The prefix string is a configurable dimension, not a pick-one fork.** Both "fixed `we-`" and
   "project-configurable" are coherent → support-both → a config-extends-default setting (platform default
   `we-`, design-system projects per #746 override). `fui-` excluded as impl-branding. This is a
   *Supported-by-default* entry, not a `## Fork N`.

## Recommendation at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — element-ness | **Opt-in / authored** (never auto-derive from `type`) | Auto-derive from `type:Component` (**broken** — fabricates `<tabs>`/`<stepper>` AND misses Module-typed elements) | High (~90%) |
| 2 — value-default posture | **Regular derivable convention** `<prefix>-<id>`, FUI's 7 names migrate; authored override only where the regular name is genuinely wrong | Per-entry authored, ratify FUI's existing names as-is | Med-high (~75%) |

**Supported by default (not a fork):** the prefix is a configurable config-layer value (platform default
`we-`; design-system projects override per #746). The compile-time/JSX + DI-override path stays totally
flexible — the convention binds only global-registration modes (ratified in #822, restated as an invariant).

## Residuals

- Fork 2's residual is migration churn vs. derivability value, and readability of a few derived names
  (`we-autocomplete` vs the hand-picked `auto-complete`). The override hatch absorbs the genuinely-wrong
  cases, so the cost is mostly the FUI rename of ~7 element registrations (#783 Check-2 already gates the
  conformance direction).
- The router→2-tags case means the #822 data model must let one block carry multiple element declarations;
  that's a build-shape detail for #822, flagged here, not a naming fork.
