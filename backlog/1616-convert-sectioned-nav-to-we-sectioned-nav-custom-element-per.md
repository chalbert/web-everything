---
kind: story
size: 3
parent: "1442"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "@frontierui/blocks/sectioned-nav/SectionedNavElement.ts (<we-sectioned-nav>)"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, sectioned-nav, frontierui]
---

# Convert sectioned-nav to we-sectioned-nav custom element (persistent light-DOM B)

Register the sectioned-nav block as a we-sectioned-nav custom element via the persistent light-DOM (B) mechanism, mirroring the shipping reference at fui:blocks/wizard/WizardElement.ts. Styled-noun nav widget with active-section state -> persistent B per the #1381 packaging guideline (we:docs/agent/block-standard.md §7). Wave-3 slice (we:reports/2026-06-22-1442-slice-wave-3.md), flat application of an already-shipping pattern, no buried fork.

## Progress

Resolved 2026-06-22 (batch-2026-06-22-1615-1208). Same persistent-B shape as the sibling #1615 disclosure-nav:

- `fui:blocks/sectioned-nav/SectionedNavElement.ts` — `SectionedNavElement` + idempotent
  `registerSectionedNav(tag='we-sectioned-nav')`; reactive `config` property; zero-config renders the shared
  default demo nav.
- `fui:blocks/sectioned-nav/SectionedNav.ts` — extracted `DEFAULT_SECTIONED_NAV_CONFIG` + added
  `mountSectionedNavLight(host, config)` (light-DOM host, boots the shared nav registry over the host's root
  node, styles via one-time `document.head` injection, never shadowed).
- `fui:blocks/sectioned-nav/index.ts` — re-exports the element + helper.
- `fui:blocks/__tests__/unit/sectioned-nav/SectionedNavElement.test.ts` — 4 pins (registration / light-DOM /
  reactive config / default). 11/11 green; FUI `check:standards` 0 errors.
- `we:src/_data/blocks/sectioned-nav.json` — `implementedBy` → the element file; `exports` + summary updated.
