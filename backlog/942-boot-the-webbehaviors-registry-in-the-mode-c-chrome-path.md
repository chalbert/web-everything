---
type: idea
workItem: story
size: 2
parent: "934"
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: embed/chrome-in-document.ts
locus: frontierui
relatedProject: webdocs
tags: [dogfood, chrome, traits, webbehaviors]
---

# Boot the webbehaviors registry in the mode-C chrome path

Instantiate a lean shared-per-page CustomAttributeRegistry (#932 lifecycle ruling), register the chrome traits, call upgrade(root) on mount and downgrade on teardown in fui:embed/chrome-in-document.ts:102 (mountInDocument). Inert no-op until trait-marked DOM lands (valid intermediate state). Root slice for #934.

## Progress (batch-2026-06-18) — resolved

- **Boot.** `fui:embed/chrome-in-document.ts` now lazily creates a **shared-per-page**
  `CustomAttributeRegistry` (`getChromeBehaviors()`) and registers the chrome traits via
  `registerNavigation` (defines `nav:section` + `nav:list`) — defined before the first `upgrade` (the
  MutationObserver's attribute filter is fixed at upgrade time). Lazy → a page with no chrome pays
  nothing; shared → a re-mount reuses definitions instead of a fresh registry per root (#932 lifecycle).
- **Lifecycle wiring.** The existing render body was extracted to `mountChrome(root)`; the public
  `mountInDocument(root)` now wraps it: `upgrade(root)` after the shell mounts, and the returned teardown
  `downgrade(root)` (detaching trait behaviors + their per-root observer) **before** tearing down the
  shell — so a re-mount can't double-wire. Both the config and default-shell paths are covered.
- **Inert no-op today.** The chrome nav is still hand-rolled (no `nav:section` markup until #944/#945),
  so `upgrade` finds nothing — a valid intermediate state.
- **Tests.** Extended `fui:embed/__tests__/chrome-in-document.test.ts` (9/9 pass): boots + tears down
  cleanly with no trait DOM (non-invasive), and one shared registry serves repeated mounts without
  cross-talk. NOTE recorded in the test: the colon-attr *upgrade* path isn't unit-assertable — jsdom
  parses `nav:section` into prefix `nav` / localName `section`, so the registry's localName-keyed
  tree-walk can't match it (real browsers keep the full name); #946's Playwright guards own that proof.
- FUI `check:standards` green (0 errors).
