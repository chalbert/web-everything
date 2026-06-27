---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "we:conformance-vectors/nav-list-a11y.vectors.ts (navListA11ySuite, registered in conformance-vectors/index.ts)"
tags: []
---

# nav-list a11y vector corpus (disclosure-navigation conformance vectors)

The W3C APG Disclosure Navigation pattern only exists in-tree as the we:demos/reveal-nav-conformance.ts demo with inline checks — there is NO reusable nav block and NO nav/disclosure a11y vector suite (current a11y vectors in we:conformance-vectors/presentation-a11y.vectors.ts are deck/slide-specific). Author the nav/disclosure a11y conformance vectors (roving tabindex, aria-expanded disclosure, no role=menuitem, focus/keyboard) so the base block the composition rule (#1795) protects has a real contract to verify against. Rule: we:docs/agent/platform-decisions.md#composition-preserves-a11y-contract.

## Resolution

Shipped `navListA11ySuite` in we:conformance-vectors/nav-list-a11y.vectors.ts (`standard: 'nav-list'`,
`contract: '@webeverything/nav-list'`), registered in we:conformance-vectors/index.ts (export + the
`conformanceSuites` registry the #899 driver enumerates). Six vectors pin the four add-only dimensions of
the `#composition-preserves-a11y-contract` contract the composition rule protects:

- **roles** — `disclosure-not-menu`: button[aria-expanded] heads + plain `<a>` links; never `role=menu` /
  `role=menuitem` (the #931 hand-roll trap, made checkable).
- **focus** — `roving-tabindex-single-tabstop`: the section heads are one tab stop; ArrowDown moves the
  roving focus; exactly one head is tabbable.
- **keyboard** — `enter-space-toggle-disclosure` (Enter/Space toggle a head's disclosure) and
  `escape-collapses-and-refocuses-head` (Escape collapses the open section and refocuses its head, never
  stranding focus on `<body>`).
- **aria** — `expanded-mirrors-state-siblings-close` (aria-expanded mirrors panel visibility, aria-controls
  wired, opening a section closes its siblings → at most one expanded) and `active-link-aria-current-page`
  (the current link carries aria-current="page", and only it).

Each judges only the observable platform surface (role / focus / aria / tab order / events), never impl
internals; the #899 driver (downstream, plateau/FUI) executes them against a candidate. Pattern mirrors the
deck-specific `presentationA11ySuite`; passes `assertConformanceSuite` (verified by the existing
`every shipped suite in the registry passes the schema` schema test).
