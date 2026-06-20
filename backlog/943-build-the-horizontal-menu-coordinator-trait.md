---
kind: story
size: 5
parent: "934"
status: resolved
blockedBy: ["941"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: blocks/navigation/NavMenubarBehavior.ts
locus: frontierui
relatedProject: webdocs
tags: [dogfood, chrome, traits, webbehaviors]
---

# Build the horizontal-menu coordinator trait

New webbehaviors trait capturing what nav:section/nav:list lack: sibling-exclusive open, outside click/focus dismiss (composedPath), responsive desktop-only gating, and Escape→collapse+refocus — the behaviors hand-rolled in fui:blocks/disclosure-nav/DisclosureNav.ts:110 wireDisclosure(). Atomic (splitting its behaviors leaves a half-trait). Own unit test + demo fixture. For #934.

## Progress (batch-2026-06-18) — resolved

New trait **`nav:menubar`** (`fui:blocks/navigation/NavMenubarBehavior.ts`), registered in
`fui:blocks/navigation/registerNavigation.ts` + exported from the index, declared in FUI
`fui:src/_data/blocks.json` `nav-list.registeredNames`.

- **Applied to the container** of a row of `nav:section` heads; carries all four coordinator behaviors
  hand-rolled in `wireDisclosure()`: sibling-exclusive open, outside click/focus dismiss (`composedPath`,
  shadow-safe), Escape→collapse+refocus, and responsive desktop-only gating (`matchMedia` 941px +
  `resize`).
- **Decoupled design (no nav:section change).** It governs *any* descendant exposing the rendered ARIA
  disclosure contract (`aria-controls` + `aria-expanded`) and collapses a section by **re-dispatching a
  click on its still-open head** — reusing `nav:section`'s own `click→toggle`, so it needs no behavior
  instance refs and never duplicates show/hide. A `#coordinating` re-entrancy flag fences its own
  close-clicks from recursing (chosen over `isTrusted`, which would also reject legitimate programmatic
  opens). Does NOT impose `role="menubar"` — APG Disclosure Navigation, not the Menu pattern.
- **Tests + fixture.** `fui:blocks/__tests__/unit/navigation/NavMenubarBehavior.test.ts` (10/10):
  exclusivity, Escape+refocus, outside click/focus dismiss, inside-click keeps open, desktop-gating,
  resize-collapse, teardown. Demo fixture: a horizontal `nav:menubar` bar added to
  `fui:demos/navigation-demo.html` (+ CSS) with `data-test` hooks for the #946 e2e guards.
- Full nav suite 53/53, FUI `check:standards` green (0 errors). Unblocks #945 (disclosure-nav rebuild).
