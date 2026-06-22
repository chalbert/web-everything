# Persistent-B element facade over a data-driven kernel — how it sources its data (#1570 prep)

**Date:** 2026-06-22 · **Item:** [#1570](/backlog/1570-/) · **Locus:** frontierui · **Status:** prepared (open)

Prep artifact for the #1570 decision. Research topic published as
`/research/persistent-b-element-data-source/`.

## TL;DR

1. **The card's "trio-shared fork" premise is refuted by the code.** Only **tree-select** has a
   data-array kernel. **type-ahead** and **data-grid** are `CustomAttribute` behaviors that **scan the
   host's light-DOM markup** — exactly the `StepperBehavior` shape. So the `StepperElement` mirror
   *does* hold for #1568/#1569; they carry **no data-source fork** and should be unblocked.
2. The one genuine question is **tree-select only**: `TreeSelectBehavior(host, nodes: TreeNode[])` does
   `host.innerHTML=''` then renders the tree from the array (render-from-data; no markup scan).
3. The prepared default — after a prior-art survey **and** a skeptic refutation that flipped it — is
   **(b) a typed `.nodes` property (B)**, mirroring `WizardElement` (the #1457-named B reference, itself
   property-sourced render-from-data). **JSON attribute (C) rejected.** **Light-DOM markup parse (A)
   demoted to a deferred additive** — admissible only once a *non-destructive* seed/scan path is
   designed and a progressive-enhancement consumer exists.

## Grounding — read the real kernels (the premise correction)

The card generalized tree-select's data-array constructor to the whole wave-3 trio. The code says
otherwise:

| Block | Kernel | Shape | Data source today |
|---|---|---|---|
| tree-select (#1567) | `TreeSelectBehavior` | **data-array** | `constructor(host, nodes: TreeNode[], opts)`; `host.innerHTML=''` then builds `<ul role=tree>` from the array — [fui:TreeSelectBehavior.ts:33,36](../../frontierui/blocks/tree-select/TreeSelectBehavior.ts) |
| type-ahead (#1568) | `TypeAheadBehavior extends CustomAttribute` | **light-DOM scan** | reads existing `[role=option]`/`[role=treeitem]` children via `ITEM_SELECTOR` — [fui:TypeAheadBehavior.ts:26-27](../../frontierui/blocks/type-ahead/TypeAheadBehavior.ts) |
| data-grid (#1569) | `DataGridBehavior extends CustomAttribute` | **light-DOM scan** | attaches to an authored `<table role=grid>` and enhances it in place — [fui:DataGridBehavior.ts:9-10](../../frontierui/blocks/data-grid/DataGridBehavior.ts) |

So for #1568/#1569 the element facade is the `StepperElement` mirror verbatim: `connectedCallback →
new <Behavior>(this)` over author markup, plus attributes + styling. **No data to source → no fork.**
(data-grid *also* ships a `renderDataGrid` data→table renderer, but #1569 was scoped over the
*behavior*, which enhances an authored table; a data-array-rendered grid, if ever wanted, is a separate
transient-A item — not this question.)

Only tree-select's kernel has no light-DOM-scan path (grep of `fui:blocks/tree-select/` shows only the
`innerHTML=''` rebuild and an internal `:scope > ul` query — no author-markup ingestion). That is the
sole locus of the decision.

## The one fork — tree-select's primary data-source

`<we-tree-select>` must supply a `TreeNode[]` to a kernel that renders from data. Candidate mechanisms:

- **(A) Light-DOM markup parse** — author writes nested `<ul><li>` (or `<we-tree-item>`), element
  parses → `TreeNode[]` before the kernel builds.
- **(B) Typed `.nodes` property** — set programmatically; the `WizardElement` shape.
- **(C) JSON attribute** — `nodes='[...]'` parsed by the element.

### Prior-art survey (full: `/research/persistent-b-element-data-source/`)

- **Native + standards + web-component trees use declarative child markup (A):** `<select>`/`<optgroup>`,
  `<datalist>`, Open UI customizable-select, the WAI-ARIA APG Tree View pattern (`role=tree/treeitem/group`
  on real DOM), Shoelace `<sl-tree>`, Fluent/FAST `<fluent-tree-view>`.
- **Framework component libs use a data property (B):** MUI X RichTreeView `items`, Ant `treeData`,
  AG Grid `rowData`, React-Aria collections.
- **A JSON-string attribute (C) is the primary mechanism in zero surveyed libraries** — clunky for deep
  hierarchies (escaped blobs, full re-parse, no per-node identity).
- **Decisive nuance:** the web-component trees (Shoelace/Fluent) keep author markup as the source of
  truth **because they render into shadow DOM** — the slot persists, the shadow tree is a projection.

### Why the default flipped to B (the skeptic pass)

The survey's first read favored **A-primary** (custom-element peers + HTML-first house style). A skeptic
sub-agent, prompted only to refute, **REFUTED** it on a load-bearing point:

> FUI's persistent-B family is **light-DOM, no shadow** (#1457/#1349 — verified: no `attachShadow` in
> wizard/stepper/tabs/deck). The Shoelace/Fluent "markup-is-source-of-truth" benefit exists *only* behind
> a shadow boundary. With no shadow, `TreeSelectBehavior`'s `host.innerHTML=''` **destroys the author's
> `<ul>`** — so under A-primary the author writes markup, the element parses it, and the kernel shreds it
> and rebuilds a *different* tree. The parse is **ceremony with negative payoff** (the author also has to
> learn a `<li data-id data-selectable>` dialect that gets thrown away). Meanwhile the in-repo B reference
> the #1457 ruling itself names — `WizardElement` — is **property-sourced render-from-data with no markup
> form**, the exact structural twin of `TreeSelectBehavior`. A-primary is the unjustified deviation; it
> also smuggles a durable public markup→TreeNode mini-API into a `size:3` "no-fork" slice.

That refutation holds. The survey's A cohort is **not a valid peer** for a no-shadow, render-from-data
element. **Default → (b) B-primary**, mirroring `WizardElement`; **(c) rejected**; **(a) deferred** until a
non-destructive seed/scan path exists (e.g. a kernel that *scans* a `<ul>` like `StepperBehavior` scans
`[data-step]` — a different, out-of-scope kernel).

### Side correction

#1567's named reference is **wrong**: it cites `StepperElement` (light-DOM scan), but tree-select's
render-from-data kernel makes **`WizardElement`** (property-sourced) the correct mirror. The decision
should repoint #1567.

## Recommended actions on ratify

- Ratify **Fork 1 (b)** — `<we-tree-select>` sources via a typed `.nodes` property; kernel unchanged.
- **Unblock #1568 and #1569** (remove `blockedBy: 1570`) — they carry no data-source fork.
- Repoint #1567's reference `StepperElement → WizardElement`; keep `blockedBy: 1570`, then build as a
  property facade.
- If HTML-first authoring of static trees is later wanted, file an additive **A** card (markup convention
  + non-destructive seed path) — not part of #1567.

## Confidence

**High (~85%)** on B-primary — kernel reality + the in-repo B precedent + a survived skeptic all converge.
Residual judgment the decider owns: whether to weight FUI's HTML-first house value highly enough to
commission the deferred-A markup form now anyway.
