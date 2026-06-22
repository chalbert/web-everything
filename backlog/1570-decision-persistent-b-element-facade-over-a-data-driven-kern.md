---
kind: decision
status: resolved
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1570-persistent-b-data-source.md
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "docs/agent/platform-decisions.md#persistent-b-data-source"
codifiedIn: "docs/agent/platform-decisions.md#persistent-b-data-source"
preparedDate: "2026-06-22"
tags: [packaging, custom-elements, persistent-b, block-model, data-source, "1442", "1457"]
---

# DECISION: persistent-B element facade over a data-driven kernel — how it sources its data

**Prepared 2026-06-22.** No design existed yet; the single open fork below is grounded in a prior-art
survey published as [/research/persistent-b-element-data-source/](/research/persistent-b-element-data-source/)
(session report `we:reports/2026-06-22-1570-persistent-b-data-source.md`, linked via `relatedReport`) and
**attacked by a skeptic pass that flipped the default**. Each fork carries a recommended default in
**bold**. **FUI packaging impl call** (`locus: frontierui`): the navigation/selection *contracts* are
WE's, the element *packaging* is FUI's (#1321).

The card was filed claiming a **fork shared by the wave-3 trio** #1567 (`we-tree-select`) / #1568
(`we-type-ahead`) / #1569 (`we-data-grid`): "the `StepperElement` mirror doesn't say how a data-driven
kernel gets its data." **Reading the real kernels refutes that premise for two of the three** — so this
shrinks to **one** genuine fork on tree-select, plus a non-fork grounding correction that unblocks the
other two.

## RULING — ratified 2026-06-22

**Fork 1 resolved → (b) typed `.nodes` property (B).** `we-tree-select` mirrors
`fui:blocks/wizard/WizardElement.ts:39` (property-sourced render-from-data); the kernel is unchanged.
A (light-DOM markup parse) is **deferred** — its declarative-authoring value is better served by
component-owned expression binding (below), so no A-seed card is commissioned now; file one only if a
real progressive-enhancement consumer for static-markup trees appears.

**Declarative form for B is component-owned, not a global behavior.** The optional `nodes="[[ data.tree ]]"`
binding is the element's **own** observed attribute, resolved in its own lifecycle by reusing
`we:plugs/webexpressions/CustomExpressionParser` as a library — explicitly **not** a globally-registered
`CustomAttribute` over arbitrary elements (ratified refinement, 2026-06-22). It is a forward additive on
top of the property; #1567 ships the plain `.nodes` property as its floor and does not wait on it.

**Consequent edits (applied on resolve):**
- #1567 (`we-tree-select`) — reference repointed `StepperElement` → `WizardElement`; `blockedBy: 1570` cleared on resolve (now agent-ready); builds as a property-facade per (b).
- #1568 (`we-type-ahead`), #1569 (`we-data-grid`) — **unblocked** (`blockedBy: 1570` removed): their kernels are light-DOM-scan `CustomAttribute` behaviors, so the `StepperElement` mirror holds verbatim — the "shared trio fork" premise was factually wrong for them.

## Recommended path at a glance

| | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **Fork 1** — `we-tree-select` primary data-source | **(b) typed `.nodes` property (B)** — mirror `WizardElement`; kernel unchanged | (a) light-DOM markup parse as *primary* (A) | High (~85%) |

Everything else here is **support-by-default or a grounding correction**, not a choice — see below.

## Axis framing — only one kernel is data-array-driven

The three wave-3 kernels decompose on one axis: **does the kernel render the semantic DOM from a data
array, or scan author light-DOM markup?**

- **tree-select — data-array (render-from-data).** `fui:blocks/tree-select/TreeSelectBehavior.ts:33`
  is `constructor(host, nodes: TreeNode[], opts)`; `:36` does `host.innerHTML = ''` then builds a
  normalized `<ul role="tree">` from the array. No markup scan — the host's contents are wiped and
  rebuilt. `TreeNode = { id, label, children?, selectable? }` (hierarchical).
- **type-ahead — light-DOM scan.** `fui:blocks/type-ahead/TypeAheadBehavior.ts:36` extends
  `CustomAttribute`; `:26-27` reads existing `[role="option"]`/`[role="treeitem"]` children via
  `ITEM_SELECTOR`. It **enhances authored markup** — the `StepperBehavior` shape exactly.
- **data-grid — light-DOM scan.** `fui:blocks/data-grid/DataGridBehavior.ts:9-10` extends
  `CustomAttribute` and enhances an authored `<table role="grid">` in place. (A separate
  `fui:blocks/renderers/data-grid/renderDataGrid.ts` data→table renderer exists, but #1569 was scoped
  over the *behavior*, which scans markup; a data-array-rendered grid, if ever wanted, is a separate
  transient-A item.)

The persistent-B reference family keeps children in **light DOM, no shadow** (#1457 / #1349 — verified:
no `attachShadow` across wizard/stepper/tabs/deck). The named B-family reference,
`fui:blocks/wizard/WizardElement.ts:39`, is **property-sourced render-from-data** (`set graph(g)`, no
markup form) — the exact structural twin of tree-select's kernel.

## Supported by default (not decisions)

- **#1568 (`we-type-ahead`) and #1569 (`we-data-grid`) carry no data-source fork.** Their kernels are
  light-DOM-scan `CustomAttribute` behaviors, so the `StepperElement` mirror holds verbatim
  (`connectedCallback → new <Behavior>(this)` over author markup, plus attributes + styling). The card's
  "shared trio fork" premise is **factually wrong** for these two. → **Recommend unblocking both** (remove
  `blockedBy: 1570`) on ratify.
- **`we-tree-select` will also support the typed `.nodes` property as its floor regardless** — that is
  the Fork 1 default itself; it is listed here only to note the property API is non-controversial.
- **#1567's named reference is wrong and should be repointed.** It cites
  `fui:blocks/stepper/StepperElement.ts` (light-DOM scan), but tree-select's render-from-data kernel makes
  `fui:blocks/wizard/WizardElement.ts` (property-sourced) the correct mirror. → repoint on ratify; keep
  `blockedBy: 1570`.

## Fork 1 — `we-tree-select`'s primary data-source form

**Fork-existence:** A-as-*primary* and B-as-*primary* cannot both be the element's declared/CEM-lead
authored form, and **A-primary is *flawed* for this kernel** (named below) — so this is a real fork (case
(a): one branch is broken, not merely a coexistence). The composability probe confirms A and B *coexist*
as primary+additive (parse-if-markup-else-property), but *which is primary* — which form the slice ships,
the CEM leads with, and docs teach — is the genuine either/or.

**Crux:** `TreeSelectBehavior` renders from a `TreeNode[]` and wipes the host (`:36 innerHTML=''`). The
element must decide where that array comes from.

- **(a) Light-DOM markup parse (A)** — author writes nested `<ul><li>` (or `<we-tree-item>`); element
  parses → `TreeNode[]` before the kernel builds. Matches the *custom-element peer* convention (native
  `<select>`/`<optgroup>`, Open UI customizable-select, WAI-ARIA APG tree, Shoelace `<sl-tree>`,
  Fluent/FAST `<fluent-tree-view>`) and FUI's HTML-first house style. **Flaw as *primary*:** those peers
  keep author markup as the source of truth *only because they render into shadow DOM*; FUI persistent-B
  is **light-DOM, no shadow**, so the kernel's `innerHTML=''` **destroys** the parsed markup — the author
  writes a `<ul>`, the element parses it, the kernel shreds it and rebuilds a different tree. The parse is
  **ceremony with negative payoff**, and it commits FUI to a durable markup→`TreeNode` mini-API inside a
  `size:3` "no-fork" slice. *Rejected as primary.*
- **(b) Typed `.nodes` property (B)** — `<we-tree-select>` exposes `.nodes` set programmatically; the
  kernel renders from it unchanged. Mirrors `fui:blocks/wizard/WizardElement.ts:39` — the in-repo B
  reference the #1457 ruling itself names, property-sourced render-from-data. Lowest friction, zero new
  public convention, consistent with the kernel and the precedent. **The "JS-only" knock is largely
  dissolved by component-owned expression binding:** `nodes` is the element's **own** attribute — declared
  in `observedAttributes` and resolved in the element's own lifecycle (`attributeChangedCallback` /
  `connectedCallback`), where it detects a `[[ ]]` expression, evaluates it, and assigns the resolved
  `TreeNode[]` to `this.nodes`. So `<we-tree-select nodes="[[ data.tree ]]">` gets a *declarative
  authoring form without child markup* — nothing for the kernel's `innerHTML=''` to destroy. **This is
  NOT a globally-registered `CustomAttribute` that matches arbitrary elements** (that would be a much
  larger, framework-grade any-element binding surface WE deliberately avoids) — it is the standard
  custom-element pattern: the component owns and wires its own attribute. It **reuses
  `we:plugs/webexpressions/CustomExpressionParser` as a library** for the evaluation —
  `we:plugs/webexpressions/CustomExpressionParser.d.ts:56` resolves an expression to **`unknown`** (an
  object/array reference, not just a string) — so the only new code is the element's own
  attribute-resolution wiring (and, if ever shared across data-driven `we-` elements, a small
  `resolveBinding(attrValue, contexts)` helper, never a registered behavior). This is a **forward
  additive on top of the property, not a feature #1567 waits on**: #1567 ships the plain `.nodes`
  property as its floor today; the attribute-binding wiring lands the declarative form later without
  touching the kernel. **Residual trade-off:** declarative binding supplies a *reference to a data
  source*, not author-authored structural child markup — which is exactly the right declarative form for
  data-array content (see the A-demotion below).
- **(c) JSON attribute (C)** — `nodes='[...]'` parsed by the element. *Rejected:* the primary mechanism
  in **zero** surveyed libraries; clunky for deep/large hierarchies (escaped blobs, full re-parse on
  change, no per-node identity). Admissible at most as a minor convenience for tiny static trees, never
  primary.

**Recommended default: (b) — typed `.nodes` property (B)**, mirroring `WizardElement`, kernel unchanged.
A is **demoted to a deferred additive**: file an A card (a decided markup convention + a *non-destructive*
seed/scan path — e.g. a kernel that *scans* a `<ul>` like `StepperBehavior` scans `[data-step]`, a
different out-of-scope kernel) only if a progressive-enhancement consumer for static markup trees appears.
**The declarative-authoring value that A claimed is better served by the webexpressions property-binder
above** (`nodes="[[ data.tree ]]"`): for data-array content, binding a *reference to a data source* is
more idiomatic than hand-authoring a `<ul>` that the kernel then shreds — so the binding path strengthens
the (b) ruling and further weakens A rather than reviving it. C rejected.

**Skeptic: REFUTED → flipped to (b).** Prep's first lean was A-primary (custom-element peer convention +
HTML-first house style). A throwaway skeptic, prompted only to refute, refuted it decisively on the
*shadow-boundary* point: Shoelace/Fluent's "markup-is-source-of-truth" benefit exists only behind a shadow
root; FUI persistent-B is light-DOM, so `innerHTML=''` destroys the author markup and the A-primary parse
is pure ceremony — while the cited B reference (`WizardElement`) is property-sourced render-from-data, the
exact twin of this kernel. The survey's A cohort is **not a valid peer** for a no-shadow render-from-data
element. Default flipped to B. **Residual the decider owns:** whether FUI's HTML-first house value is
weighted highly enough to commission the deferred-A markup form *now* anyway (the only real judgment left).

---

## Context

- **Parent:** epic #1442 (block-model conversion). **Sibling ruling:** #1457 (support-both,
  element-over-behavior; persistent-B = the styled `we-` element hosting the kernel, light-DOM children,
  CEM surface). This decision is a *consumer refinement* of #1457 for the render-from-data sub-case the
  trio surfaced.
- **Blocks:** #1567 (`we-tree-select`) — `blockedBy: 1570`, the genuine consumer of Fork 1. #1568 /
  #1569 are `blockedBy: 1570` **on a refuted premise** — unblock on ratify.
- **Graduation:** ratifying Fork 1 (b) yields #1567 as a property-facade build (mirror `WizardElement`).
  No Technical Configurator card (the data-source is a public element API, not an inherited platform
  setting). If the deferred-A markup convention is later commissioned, *that* is the card that documents
  the markup→`TreeNode` mapping.
- Surfaced 2026-06-22 (batch-2026-06-22-1545-1549) grounding #1567; prepared 2026-06-22 with a web
  prior-art survey + a skeptic flip.
