---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: block:segmented-control
tags: [block, segmented-control, compound-children, segment, selection, paradigm, candidate, harvest]
relatedProject: webblocks
---

# Segmented control block + the compound-child "segment" paradigm

Two related deliverables surfaced together: a concrete **Segmented control** block, and the cross-cutting **compound-child ("segment")** paradigm it exemplifies.

**Segmented control** — a single-select choice rendered as a row of adjacent buttons (iOS/macOS segmented control, "pill" toggle group). It's the Selection Intent's `single` model in a horizontal, always-visible variant (compare radio group / select / switch). Composes **Selection Intent** (`single`, `live` immediacy), **Focus Delegation** (`roving`, `horizontal`), and the typography/density intents for sizing.

**The compound-child paradigm** — the one genuinely-developed concept in the legacy repo: *sub-elements that act as options for a parent* (e.g. a `<segment>` inside the control, an `<option>` inside a select, a `<tab>` inside Tabs). It recurs across the standard (Tabs, the grouping axes of Selection, menus) but isn't named as a shared contract. Capture it as a **candidate composable paradigm**: how a parent block declares its options as authored children, how those children map to the value model, and how the same authoring lowers under the JSX adapter (children → an options array rather than rendered components).

## Scope to design (via [we:design-first.md](../docs/agent/design-first.md))

- The segmented-control block itself (variant of Selection `single`).
- Whether "compound children → options" deserves its own intent/protocol or is documentation of an existing one; verify overlap with Selection's grouping (`<optgroup>` / `role=group`) and Tabs.
- The adapter story: declarative children vs. an `options` prop, and how each lowers.

> **Provenance:** surfaced during a final review of the legacy `plateau` repo (`we:segments.md` — its only fleshed-out concept). **Plateau is not a model and must not be consulted or copied** — treat this as a fresh design.

## Progress

- **Status:** resolved → `block:segmented-control` (the block half). The compound-child paradigm fork is **spun out** to **#258** (decision item).
- **Done (authored fresh, design-first):**
  - `fui:blocks.json` — new `segmented-control` Component (status draft): `implementsIntent: selection`, `composesIntents: [selection, focus-delegation, typography, density]`, and 4 design decisions (Selection `single` always-visible/live, not a new model / roving-horizontal keyboard delegated to Focus Delegation / options as compound children + the carried-forward fork / distinct from multi-select group and Tabs).
  - `we:block-descriptions/segmented-control.njk` — overview, a "where it sits among single-select members" comparison table, a composition table (nothing re-implemented), an Altitude-1 compound-children HTML example, a dedicated compound-child-paradigm section stating the open decision + recommended default, and boundaries.
  - `we:semantics.json` — two new terms: **Segmented Control** and **Compound Child** (per AGENTS rule 3).
  - Page route + webblocks catalog auto-wire from `fui:blocks.json`. `gen:inventory` regenerated (37 blocks); `check:standards` green (0 errors).
- **Fork carried forward (not settled here):** "compound child → option" promote-to-protocol vs document-under-Selection → **#258**, with the bold-defaulted recommendation (document as a shared paradigm / protocol-semantics term, not a new UX intent). The block adopts the pattern directly and references the open decision in its design.
- **Leftovers:** the JSX adapter's children→options lowering for compound children is named but not specified — folded into #258's "before deciding" checks. Frontier UI reference implementation is the standard-vs-impl follow-on.
