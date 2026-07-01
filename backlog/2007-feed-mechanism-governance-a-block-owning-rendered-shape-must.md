---
kind: decision
parent: "1321"
status: open
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
preparedDate: "2026-07-01"
relatedReport: reports/2026-07-01-feed-mechanism-governance-reconciliation.md
tags: [composition, block-standard, feed-mechanism, light-dom, governance]
---

# Feed-mechanism governance — a block that *re-renders/restructures* is fed template/data; a *structure-preserving* enhancer may read live DOM via `data-*`

**Archetype: validation-gate (go/no-go on a candidate rule), not a fork.** One-sided — the question is
whether to admit a governance statement, not which of two coherent branches to pick.

## Digest + verdict

The candidate rule as first drafted — *"a block that owns its rendered shape must be fed inert `<template>`
or attr-expression, never live already-rendered light-DOM it then mutates"* — **does not survive prep as a
new corollary.** The prep skeptic (four axes, see the [prep reconciliation report](../reports/2026-07-01-feed-mechanism-governance-reconciliation.md))
found it **collides with a ratified statute** (#1867), **duplicates** another (#1818), and **mis-cites** its
claimed authority (#1983/#1986). What survives is a **re-scoped, re-cited** version: a *consolidating*
authoring entry — not a new independent statute — that states one genuinely-useful discriminator and points
at the cluster that already governs this ground.

**Verdict (recommended default): GO on the re-scoped consolidation.** Admit into
[we:docs/agent/block-standard.md](../docs/agent/block-standard.md) (alongside the #1321 packaging governance)
a short authoring note whose operative content is the **restructure-vs-enhance discriminator**, with
`codifiedIn: #1818, #1570` and #1983/#1986 demoted to a supporting analogy. *Not* the blanket
"owns-rendered-shape → no live DOM" rule as drafted.

## The rule that survives (re-scoped)

> **A `we-` block that *re-renders or restructures* its output is fed inert `<template>` or `[[ ref ]]`
> data (per [we:platform-decisions.md #block-data-ingestion](../docs/agent/platform-decisions.md#L1016-L1018)
> #1818 / [we:platform-decisions.md #persistent-b-data-source](../docs/agent/platform-decisions.md#L979-L981)
> #1570) — never live author markup-as-source. A *structure-preserving in-place enhancer* (a light-DOM-scan
> kernel, #1570; the #1867 data-table enhancer) legitimately reads a live SSR subtree, provided it consumes
> `data-*` typed data off nodes and never reparses rendered text or restructures. That is the ratified
> default, not a violation.**

The discriminator authors apply: **does the block re-render/restructure (sort by rebuilding, mobile card
view, re-layout) or only reorder/hide the existing nodes?** Re-render ⇒ must be fed data. Enhance-in-place ⇒
may read live DOM, but its *source of truth* must be `data-*` data on the nodes, never the rendered text.

## The forced tension (why a discriminator exists at all)

You cannot simultaneously **(1)** feed a component *live, already-rendered* markup as its source of truth and
**(2)** have it *restructure* that content (mobile card view, re-layout). Enhancing live DOM in place can
only do **structure-preserving** transforms — reorder existing nodes, `hidden`. A different layout requires
re-rendering, which clobbers consumer-owned DOM (the build↔client skew #1867 set out to kill). So a block
that wants freedom over the rendered *shape* must not be handed the finished shape — it is fed data. This is
real, but it is **already the #1570/#1818 kernel-shape split**, not new ground.

## Prior-art delta — what the ground already covers, and the residue

| Anchor | Already governs | file:line |
|---|---|---|
| `#block-data-ingestion` (#1818) | "Raw author markup is **never** a data source for a render-from-data kernel." | [we:platform-decisions.md:1016](../docs/agent/platform-decisions.md#L1016-L1018) |
| `#persistent-b-data-source` (#1570) | The light-DOM-scan enhance-in-place kernel "has *no* data-source fork" — the legitimate live-DOM lane. | [we:platform-decisions.md:979](../docs/agent/platform-decisions.md#L979-L981) |
| `#ssr-data-table-build-harness` (#1867) | RATIFIED `<td data-sort-value>` + in-place enhancer that reorders/hides existing rows, no re-render. | [we:platform-decisions.md:1259](../docs/agent/platform-decisions.md#L1259-L1272) |
| Directive form (#1983/#1986) | Inert `<template>` vs live comment-boundary — for **directive bodies** (region control); rule 4 excludes behaviors/block-feed. | [we:block-standard.md:358](../docs/agent/block-standard.md#L358-L395) |

**Residue #2007 legitimately adds** (why it is not a pure no-op): the principle above is currently *scattered*
across three platform-decisions anchors and **never stated in the authoring-facing
[we:docs/agent/block-standard.md](../docs/agent/block-standard.md) as block-feed guidance an author reads at
authoring time.** Consolidating it there — as a cross-reference plus the one-line restructure-vs-enhance test
— is the delta. It writes no new *substance*; it relocates and names existing substance where authors look.

## Why not a fork

The fork-existence test fails: there is no coherent second branch where a block *re-renders/restructures* its
output **and** is legitimately fed live markup-as-source — re-rendering destroys the fed markup on first
`replaceChildren`/`innerHTML=''` (#1818's named broken branch). The only live-DOM-feed lane that survives is
the structure-preserving enhancer, and that is *already ratified* (#1570/#1867), not an alternative to weigh.
So this is a go/no-go on admitting a consolidating statement, not a choice between designs.

## Worked contrast (compliant vs violating, under the re-scoped rule)

- **Compliant — the #1976 `async:await` directive:** `promise="@user.profile"` (attr-expression) + inert
  `<template slot="pending|then|catch">`. The component owns the branch it stamps; nothing live is source.
- **Compliant — the #1867 data-table SSR enhancer:** fed a live `<table>` **whose cells carry `data-*` typed
  values**; the enhancer reorders/hides existing rows reading those `data-*` keys, never reparsing `<td>`
  text, never restructuring. Live DOM present, but the *source of truth is data*. **This is the ratified
  default — under the corrected rule it is compliant, not the violation the first draft called it.**
- **Violating — a `we-data-table` that treats a hand-authored `<table>` as its data source-of-truth and
  restructures it** (sort by rebuilding, mobile card view) without the `data-*` contract. That is the #2008
  defect: an inert `<we-data-table>` wrap around a plain `<table>` with no `.data-table`/`data-sortable`/
  `data-sort-value` — decidable by #1867's contract **today**, no new rule required.

## The call

**Recommendation: GO — admit the re-scoped consolidating note** into
[we:docs/agent/block-standard.md](../docs/agent/block-standard.md); `codifiedIn: #1818, #1570`; #1867 named
as the canonical *compliant* exemplar; #1983/#1986 as supporting analogy only. **Concrete un-gate is
automatic** — the note is authored at ratify time and #2008 is retargeted (below). The decider may instead
pick the **NO-GO / close-as-redundant** branch (the skeptic's Axis-0 position: the substance is fully covered
by #1818+#1570+#1867, so add nothing and just retarget #2008); prep's default is GO because the authoring doc
is what authors actually read and the restructure-vs-enhance test is a useful one-liner not stated there.

**Skeptic:** SURVIVES-WITH-AMENDMENT (major). Four-axis prep attack: **Axis-0 classification REFUTED** — the
drafted rule is already settled by #1818 + #1570, so the *new-corollary* framing is wrong; demoted to a
consolidating cross-reference. **Axis-1 merit SURVIVES-WITH-AMENDMENT** — a coherent live-DOM-feed block
exists (the #1867 structure-preserving enhancer), so "owns rendered shape → no live DOM" was too broad;
re-scoped to *re-renders/restructures* vs *enhances-in-place*. **Axis-2 statute-overlap REFUTED-as-drafted** —
direct collision with #1867 (the draft branded a ratified statute a violation); reconciled by naming #1867 the
canonical compliant exemplar and moving the source-of-truth test to `data-*`-not-live-markup. **Axis-3
citation-scope REFUTED** — #1983/#1986 (directive-form) is scoped by its own rule 4 to directive bodies, not
block-feed; downgraded from authority to supporting analogy, operative authority set to #1818 + #1570.

## Downstream

- **#2008** (the `we-data-table` dual-feed defect) is **no longer gated on a new rule** — the skeptic showed
  the inert #1600 wrappers are a **missing-`.data-table`-contract** defect decidable by #1867 today. On ratify,
  clear `blockedBy: ["2007"]` on #2008 and repoint it: *"complete the #1867 contract or revert the wrap."*
- This decision, if GO, writes `codifiedIn` cross-referencing the #1818/#1570/#1867 cluster into the block
  authoring standard — not a fresh platform-decisions anchor.
