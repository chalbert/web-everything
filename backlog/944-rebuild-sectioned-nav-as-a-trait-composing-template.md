---
type: idea
workItem: story
size: 2
parent: "934"
status: resolved
blockedBy: ["941", "942"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: blocks/sectioned-nav/SectionedNav.ts
locus: frontierui
relatedProject: webdocs
tags: [dogfood, chrome, traits, webbehaviors]
---

# Rebuild sectioned-nav as a trait-composing template

Retire the hand-rolled per-section accordion toggle in fui:blocks/sectioned-nav/SectionedNav.ts:56 onto the nav:section trait (no coordinator — a vertical accordion has no sibling-exclusivity). Keep presentational CSS. Note: sectioned-nav isn't in fui:embed/chrome-in-document.ts today, so confirm/wire its registry mount. For #934.

## Progress (batch-2026-06-18) — resolved

- **Toggle retired onto the trait.** `buildSection` in `fui:blocks/sectioned-nav/SectionedNav.ts` now
  emits declarative `nav:section="#listId"` markup — the imperative `click` + per-section Escape `keydown`
  listeners are gone. `nav:section` owns aria-expanded / aria-controls, the click + Enter/Space toggle,
  Escape→collapse, and show/hide. No coordinator: a vertical accordion has no sibling-exclusivity.
- **Initial state via `hidden`.** Collapsed sections set the list's `hidden` attribute — exactly what
  `nav:section`'s ViewEngine (display mode) reads on connect and toggles, so the presentational CSS
  (`.list[hidden]`, kept unchanged) and the trait stay in sync.
- **Registry mount wired.** `mountSectionedNav` boots a lazy shared-per-page `CustomAttributeRegistry`
  (`registerNavigation`), `upgrade(root)` on mount, `downgrade(root)` on teardown — so the standalone
  block activates its `nav:section` heads (the chrome path is upgraded by #942's registry instead).
- **Escape moved into the trait.** Added Escape→collapse+refocus to `fui:.../NavSectionBehavior.ts` (it's
  intrinsic to a single disclosure, so both sectioned-nav and the #943 menubar inherit it from the trait
  rather than hand-rolling). +2 NavSection tests.
- **Tests.** `fui:blocks/__tests__/unit/sectioned-nav/SectionedNav.test.ts` re-pointed to assert the trait *markup* + that an un-upgraded head
  click is inert (proof the hand-rolled toggle is gone); behavior lives in NavSectionBehavior's suite.
  62/62 across nav + sectioned-nav; FUI `check:standards` green. (jsdom can't upgrade the colon attr, so
  real-browser activation is #946's e2e.) Unblocks #945.
