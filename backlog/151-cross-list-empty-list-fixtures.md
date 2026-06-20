---
kind: task
parent: "130"
status: resolved
dateOpened: '2026-06-07'
dateResolved: "2026-06-07"
graduatedTo: blocks/renderers/reorderable-list/__fixtures__/cross-list-reorder-cases.ts
tags:
  - reorder
  - cross-list
  - reorderable-list
  - conformance
  - fixtures
relatedReport: reports/2026-06-06-reorder-paradigms.md
relatedProject: webtraits
crossRef: { url: /blocks/reorderable-list/, label: Reorderable List block }
---

# Add cross-list conformance fixtures for empty lists

The cross-list reorder engine shipped in [#146](/backlog/146-cross-list-reorder-trait/)
(`withCrossListReorder`) already **handles** empty lists — `reduceCrossListReorder` guards a grab on an
empty focused list (`id === undefined` → no-op), `relocate` clamps the drop index into a zero-length
target (inserts at 0), and the playground's pointer path hit-tests an empty column and defaults the
slot to the end. But the shared fixtures (`we:cross-list-reorder-cases.ts`) don't cover those edges, so
the conformance suite doesn't pin them.

## Scope

Add fixture cases (which the CI suite and the playground both run) for:

- **Emptying a list** — move the only item out of a list; assert the source list ends empty and the
  group still audits clean (group-wide roving tabindex, the now-empty `<ul>` still grounded).
- **Crossing into an empty list** — grab an item and cross into a list that has no items; assert it
  lands at position 1 and the announcement reads correctly.
- **Focus into / out of an empty list** — Left/Right roving onto an empty list (focusIndex clamps to
  0, nothing focusable) and back, with the group-wide roving-tabindex invariant intact.

## Notes

- Pure test/fixture work — the engine, renderer, announcer, and audit in
  `we:blocks/renderers/reorderable-list/renderCrossListReorder.ts` already implement the behavior; this
  hardens the verified contract against regressions.
- Mirror the fixture-driven anti-drift pattern: each case is a per-list order model + key sequence +
  expected state + expected announcement, double-entered against the reducer and the audit.
