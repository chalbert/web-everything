# Feed-mechanism governance — reconciliation against the ratified data-ingestion cluster (#2007 prep)

**Date:** 2026-07-01 · **Item:** #2007 (validation-gate decision) · **Type:** prep grounding, no ruling.

## Question

#2007 proposed a one-sided GO: codify in `we:docs/agent/block-standard.md` a "feed-mechanism corollary" —
*a block that owns its rendered shape must be fed inert `<template>` or attr-expression (data), never live
already-rendered light-DOM it then mutates* — claimed as the block-feed corollary of the directive-form
inert/live rule (#1983/#1986).

## What the ground already says (the statute-overlap surface)

The render-data-as-view feed question is **already ruled** by a three-anchor cluster in
`we:docs/agent/platform-decisions.md`:

- **`#block-data-ingestion` (#1818), L1016–1018.** "Raw author markup is **never** a data source for a
  render-from-data kernel … markup-as-source stays exclusively the **light-DOM-scan** kernel's contract; the
  two kernel shapes never mix in one element." This *already decides* the render-from-data half of #2007.
- **`#persistent-b-data-source` (#1570), L979–981.** A **light-DOM-scan** kernel (`CustomAttribute`
  enhancing authored markup in place — type-ahead, data-grid, stepper) "has *no* data-source fork." That is
  the ratified legitimate live-DOM-feed lane — the exact "opaque projection" carve-out #2007 re-invents.
- **`#ssr-data-table-build-harness` (#1867), L1259–1272.** RATIFIED (2026-06-27): the interactive data-table
  cell carries its raw typed value as `data-*` on the SSR `<td>` (`<td data-sort-value="2026">`), and a
  small **in-place DOM enhancer** "reorders/hides the **existing** rows. There is **no JSON island and no
  client re-render** — so the build↔client **render-skew class is structurally gone**."

## The collision #2007-as-drafted creates

#2007's "Violating" example says `we-data-table`'s SSR-enhance path is *"fed a **live** `<table>` and reaches
in to mutate it … diagnosable purely by this rule [as a violation]."* But that is **precisely the mechanism
#1867 ratified as the correctness-superior default.** As drafted, #2007 would brand a ratified statute a
governance violation. That is a statute collision, not a corollary.

Resolution: #1867 is **compliant under the correct rule** because its enhancer (a) reads `data-*` **data**
off the cells (never reparses rendered `<td>` text — #1867's own correctness invariant) and (b) is
**structure-preserving** (reorder/hide, never restructure into a card view). The real line is not
*owns-rendered-shape* — it is **re-renders/restructures (→ must be fed data) vs enhances-in-place
structure-preservingly (→ may read a live subtree via `data-*`)**. That line already lives in the
#1570/#1818 kernel-shape split.

## Citation-scope finding

#2007 cited the directive-form three-forms table (#1983/#1986, `we:docs/agent/block-standard.md` §Directive
form) as the *authority* that "already fixes the shape." That section's scope is explicit — "the catalog-wide
**authoring form** for a **directive** — the markup vehicle carrying its name + options + body" (L361) — and
rule 4 draws a hard boundary: these forms are for **directives** (region control); a construct that decorates
or reactively updates a *connected* element is a **behavior** and "takes **none** of these forms." Block-feed
(how a component ingests data/children) is the behavior/block side rule 4 puts out of scope. So #1983/#1986
is a **sibling analogy, not authority**; the operative authority is #1818 + #1570.

## Net for prep

The blanket GO is refuted as drafted (collides with #1867, duplicates #1818, mis-cites #1983/#1986). A
narrow, admissible residue survives-with-amendment: a **consolidating** authoring entry in
`we:docs/agent/block-standard.md` stating the restructure-vs-enhance-in-place discriminator and pointing at
the #1818/#1570/#1867 cluster — `codifiedIn: #1818, #1570`, #1867 named as the canonical *compliant*
exemplar, #1983/#1986 demoted to supporting analogy. The downstream defect #2008 is narrower than #2007
claimed: the inert #1600 wrappers lack the `.data-table`/`data-sortable`/`data-sort-value` contract — a
**missing-contract** defect decidable by #1867 **today**, independent of any new rule.

Skeptic verdicts (four axes): Axis-0 classification REFUTED (already settled by #1818+#1570) · Axis-1 merit
SURVIVES-WITH-AMENDMENT (in-place enhancer carve-out mandatory) · Axis-2 statute-overlap REFUTED-as-drafted
(direct #1867 collision) · Axis-3 citation-scope REFUTED (#1983/#1986 → supporting analogy).
