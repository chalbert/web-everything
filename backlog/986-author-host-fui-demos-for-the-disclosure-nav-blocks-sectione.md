---
kind: story
size: 2
parent: "972"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/disclosure-sectioned-nav-demo.html"
tags: []
---

# Author + host FUI demos for the disclosure-nav blocks (sectioned-nav, disclosure-nav)

Author runtime demos for sectioned-nav and disclosure-nav (APG disclosure navigation) in fui:demos/ and wire demoFile. Slice of #972; locus frontierui.

## Progress — done in batch-2026-06-18

Authored `fui:demos/disclosure-sectioned-nav-demo.html` (reuses `fui:demos/playground.css`): mounts both APG
disclosure-navigation blocks, each in its own shadow root via the block's `mount*(shadowRoot, config)` API
with a shared 3-section sample config —
- **disclosure-nav** — `mountDisclosureNav` (horizontal header, sibling-exclusive dropdown panels via the
  `nav:menubar` trait).
- **sectioned-nav** — `mountSectionedNav` (vertical collapsible sections via `nav:section`).

The nav behaviors self-boot (`getNavBehaviors()` builds its own `CustomAttributeRegistry`; no global
bootstrap needed). Wired `demoFile` on both blocks + cleared them from `DEMO_PENDING`
(`fui:scripts/check-standards.mjs`, #973). **Playwright-verified on :3001**: both `<nav>` landmarks render
with 3 section heads, clicking a disclosure head flips `aria-expanded` false→true, 0 console errors. FUI
check:standards green.
