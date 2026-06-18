---
type: idea
workItem: story
size: 3
parent: "934"
status: resolved
blockedBy: ["941", "943", "942"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: blocks/disclosure-nav/DisclosureNav.ts
locus: frontierui
relatedProject: webdocs
tags: [dogfood, chrome, traits, webbehaviors]
---

# Rebuild disclosure-nav as a trait-composing template

Emit `<button nav:section=…>` + coordinator-trait markup and keep the presentational horizontal/responsive CSS; delete wireDisclosure() in fui:blocks/disclosure-nav/DisclosureNav.ts:110-163 so behavior flows through the registry. Needs shadow-safe nav:section (#941), the coordinator trait (#943), and the booted registry (#942) — DAG ordering prevents a dead-chrome-nav intermediate. For #934.

## Progress (batch-2026-06-18) — resolved

- **`wireDisclosure()` deleted.** `fui:blocks/disclosure-nav/DisclosureNav.ts` now emits declarative
  trait markup: `nav:menubar` on the `<nav>` container (#943 coordinator — sibling-exclusivity, outside
  dismiss, Escape, desktop-gating) and `nav:section="#panelId"` on each head (#941 per-section disclosure
  — toggle, aria, show/hide). `createDisclosureNav` builds markup only; the ~55-line ported `reveal-nav.js`
  function is gone.
- **Reveal CSS adapted to the trait's state, kept presentational.** `nav:section` toggles the panel's
  `hidden` attribute (display-mode ViewEngine), so the reveal keys off `.panel:not([hidden])` instead of
  the old `[aria-expanded="true"] +` adjacency, plus `.panel[hidden] { display:block }` to keep the panel
  in flow so the opacity/transform dropdown animation still runs. CSS `:hover` reveal + all colors/spacing/
  responsive layout unchanged. Initial collapsed state = `panel.hidden = true`.
- **Registry mount.** `mountDisclosureNav` boots a lazy shared `CustomAttributeRegistry`
  (`registerNavigation`), `upgrade`/`downgrade` per root. Composed into the #865 chrome shell, the nav is
  upgraded by #942's chrome registry instead — end-to-end trait composition.
- **Tests.** Unit suite re-pointed to assert the trait-composition contract (nav:menubar present,
  nav:section markup, default-hidden panels, un-upgraded click inert). Updated the chrome-in-document #931
  regression guard (broken by this change) to assert the declarative collapsed markup. **921/921 FUI tests
  pass**, `check:standards` green. (Real-browser activation of the colon-attr traits → #946 e2e.) #934's
  last build slice — only #946 (guards) remains to close the epic.
