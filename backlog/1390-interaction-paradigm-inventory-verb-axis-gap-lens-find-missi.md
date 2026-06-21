---
kind: story
size: 5
parent: "1399"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:.claude/skills/gap-sweep-rerun/SKILL.md"
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
| **marquee / rubber-band select (2-D)** | `selection` = choice, not spatial | ❌ → [#1406](/backlog/1406-marquee-rubber-band-selection-2-d-drag-select-standard-place/) (sweep) |
| **scroll-driven UI (progress / scroll-spy)** | `viewport-presence` = enter/leave only | ~ → [#1407](/backlog/1407-scroll-driven-ui-scroll-progress-scroll-spy-scroll-linked-an/) (sweep) |
| **content annotation / highlight** | — | ❌ → [#1408](/backlog/1408-content-annotation-highlight-comment-on-selection-standard-p/) (sweep) |

> **Verb axis completeness-swept 2026-06-21.** Second pass added the three rows above (#1406–#1408).
> Adjacent verbs routed to other lenses, not filed here: Web Share → platform-API ([#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/));
> collaboration / presence / multiplayer → data-lifecycle ([#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/)) / app-infra ([#1402](/backlog/1402-discovery-lens-app-infrastructure-cross-cutting-concerns-inv/));
> media scrubbing → partial via `slider` + `temporal`. The verb axis is considered exhausted for this round.

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

> **Harvest fully filed (2026-06-21):** zoom/pan → [#1393](/backlog/1393-zoom-pan-a-surface-viewport-scale-translate-standard-placeme/);
> undo/redo → [#1394](/backlog/1394-undo-redo-reversible-mutation-history-standard-placement/);
> optimistic-mutation → [#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/);
> pointer-gestures → [#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/);
> in-place/inline-edit → [#1397](/backlog/1397-in-place-inline-edit-edit-in-place-editable-cell-standard-pl/);
> progressive-loading → [#1398](/backlog/1398-progressive-loading-infinite-scroll-load-more-standard-place/).

## Done when

- ✅ The verb-checklist + matrix live in the gap-sweep skill so the verb axis reruns with the component axis
  — wired into `we:.claude/skills/gap-sweep-rerun/SKILL.md` step 4b (#1390, 2026-06-21).
- ✅ Each harvested candidate filed as a placement decision (#1393–#1398; + the second-pass #1406–#1408) or
  routed to another lens with a reason (Web Share → #1257; collaboration → #1402/#1403; media-scrubbing →
  `slider`+`temporal`).

**Round 1 complete (2026-06-21, batch-2026-06-21-1385-1392)** — verb axis completeness-swept, all candidates
filed/routed, and the lens is now part of every /gap-sweep run.
