---
type: idea
workItem: story
size: 3
status: open
dateOpened: "2026-06-07"
tags: [block, segmented-control, compound-children, segment, selection, paradigm, candidate, harvest]
relatedProject: webblocks
---

# Segmented control block + the compound-child "segment" paradigm

Two related deliverables surfaced together: a concrete **Segmented control** block, and the cross-cutting **compound-child ("segment")** paradigm it exemplifies.

**Segmented control** — a single-select choice rendered as a row of adjacent buttons (iOS/macOS segmented control, "pill" toggle group). It's the Selection Intent's `single` model in a horizontal, always-visible variant (compare radio group / select / switch). Composes **Selection Intent** (`single`, `live` immediacy), **Focus Delegation** (`roving`, `horizontal`), and the typography/density intents for sizing.

**The compound-child paradigm** — the one genuinely-developed concept in the legacy repo: *sub-elements that act as options for a parent* (e.g. a `<segment>` inside the control, an `<option>` inside a select, a `<tab>` inside Tabs). It recurs across the standard (Tabs, the grouping axes of Selection, menus) but isn't named as a shared contract. Capture it as a **candidate composable paradigm**: how a parent block declares its options as authored children, how those children map to the value model, and how the same authoring lowers under the JSX adapter (children → an options array rather than rendered components).

## Scope to design (via [design-first.md](../docs/agent/design-first.md))

- The segmented-control block itself (variant of Selection `single`).
- Whether "compound children → options" deserves its own intent/protocol or is documentation of an existing one; verify overlap with Selection's grouping (`<optgroup>` / `role=group`) and Tabs.
- The adapter story: declarative children vs. an `options` prop, and how each lowers.

> **Provenance:** surfaced during a final review of the legacy `plateau` repo (`segments.md` — its only fleshed-out concept). **Plateau is not a model and must not be consulted or copied** — treat this as a fresh design.
