---
kind: story
size: 5
parent: "1399"
status: open
dateOpened: "2026-06-21"
tags: [method, gap, coverage, interaction-paradigm, verb-axis, book-candidate, gap-sweep]
---

# Interaction-paradigm inventory — verb-axis gap lens (find missing standards a component-diff misses)

A second coverage lens, complementary to [/gap-sweep](/backlog/) (which benchmarks design-system
**component catalogs**). The gap-sweep ran dry 2026-06-20 — the *component* axis is saturated — yet an
ad-hoc probe still found a whole uncovered cluster ([#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/),
resize/snap/dashboard). Reason: those are **interaction verbs** (gestures/behaviors) no single
component owns, so a catalog diff can't see them. This item makes that lens systematic — enumerate the
universal user *verbs*, map each to an existing WE intent, and the vacant rows are candidate standards.
First pass below; the recurring job is to **wire this verb-checklist into the gap-sweep skill** so both
axes get checked every run.

## The method (verb → intent matrix)

1. Maintain a checklist of universal direct-manipulation / interaction verbs (not components).
2. For each verb, find the owning intent in [we:src/_data/intents/](../src/_data/intents/) (✓), a partial
   owner (~), or none (❌).
3. Each ❌ / ~ is a candidate standard → file as a `decision` placement item (like #1384), let it
   fan out on prep. Don't pre-mint intents.
4. Fold the checklist into the gap-sweep skill so it reruns idempotently with the component diff.

## First-pass matrix (2026-06-21)

| Verb / paradigm | Owner | Status |
|---|---|---|
| select (single/multi) | `selection` | ✓ |
| type-ahead / autocomplete | `type-ahead` | ✓ |
| reorder (1-D list) | `reorder` | ✓ |
| sort / filter / group | `collection-operations` | ✓ |
| copy / cut / paste / drag-payload | `data-transfer` (+ build [#007](/backlog/007-gap-11-clipboard-dnd-files-intents/)) | ✓ |
| expand / collapse / reveal | `disclosure` | ✓ |
| fullscreen | `fullscreen` | ✓ |
| invoke command / palette / keybinding | `command` | ✓ |
| observe in/out of view | `viewport-presence` | ✓ |
| virtualize large collection | `windowed-collection` | ✓ |
| input modality (pointer/touch/spatial) | `interaction` | ✓ (parent for gestures) |
| hover-with-intent | `hover-intent` | ✓ |
| **resize a pane (splitter)** | — | ❌ → [#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/) |
| **snap to grid / alignment** | — | ❌ → #1384 |
| **arrange / drag in 2-D (dashboard)** | `reorder` (1-D only) | ~ → #1384 |
| **zoom / pan a surface** | — | ❌ candidate |
| **undo / redo (reversible history)** | `command` = invoke, not history | ❌ candidate |
| **optimistic mutation (apply→reconcile→rollback)** | — | ❌ candidate |
| **pointer gestures (swipe / long-press / pinch / pull-to-refresh)** | `interaction` = modality, not gestures | ~ candidate (likely extend `interaction`) |
| **in-place / inline edit (editable cell, edit-in-place)** | — | ❌ candidate (verify vs data-grid) |
| **progressive load / infinite-scroll / load-more** | composes `viewport-presence` + `windowed-collection` | ~ candidate (no explicit pattern) |

## Harvest — candidate standards to carve (not yet filed)

Each becomes its own placement `decision` item (à la #1384) when worked:

- [ ] **Zoom / pan** — scale + translate a viewport surface (image viewer, map, canvas, diagram).
- [ ] **Undo / redo** — reversible-mutation history / command-stack; distinct from `command` invocation
  and `draft-persistence` autosave.
- [ ] **Optimistic mutation** — apply locally, reconcile with the source of truth, roll back on failure.
- [ ] **Pointer gestures** — swipe / long-press / pinch / pull-to-refresh; pressure-test as an extension
  of the `interaction` intent vs a new intent.
- [ ] **In-place / inline edit** — edit-in-place + editable grid cell; confirm `data-grid` doesn't
  already own it before filing.
- [ ] **Progressive loading** — infinite-scroll / load-more / pagination-on-scroll; may be a composition
  pattern over existing intents rather than a new one.

## Done when

- The verb-checklist + matrix live in the gap-sweep skill (or a sibling skill) so the verb axis reruns
  with the component axis.
- Each harvested candidate above is either filed as a placement decision or explicitly dismissed with a
  one-line reason (covered / not-a-standard).
