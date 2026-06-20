---
kind: task
parent: "934"
status: resolved
blockedBy: ["945", "944"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: plugs/__tests__/e2e/navigation.spec.ts
locus: frontierui
relatedProject: webdocs
tags: [dogfood, chrome, traits, webbehaviors]
---

# Update #931 regression guards to assert trait composition

Update the 4 guard files (unit fui:blocks/__tests__/unit/disclosure-nav/DisclosureNav.test.ts:63, fui:blocks/__tests__/unit/sectioned-nav/SectionedNav.test.ts:45, integration fui:embed/__tests__/chrome-in-document.test.ts:85, e2e fui:plugs/__tests__/e2e/navigation.spec.ts:94) to assert trait composition (nav:section present + registry upgraded), not just collapsed-by-default DOM; keep the Playwright behavior checks (open/Escape/outside-click). Closes #934's done-when verification.

## Progress (batch-2026-06-18) — resolved

All 4 guards now assert **trait composition**, not hand-rolled DOM:

- **Unit (`fui:blocks/__tests__/unit/disclosure-nav/DisclosureNav.test.ts`, `fui:.../sectioned-nav/SectionedNav.test.ts`)** — re-pointed during #945/#944 to assert the
  declarative trait markup (`nav:menubar` on the container, `nav:section="#panel"` on heads, default-hidden
  panels) and that an *un-upgraded* head click is **inert** (proof the hand-rolled toggle is gone).
- **Integration (`fui:embed/__tests__/chrome-in-document.test.ts`)** — the #931 collapsed-by-default guard now asserts
  `nav:section` markup + `panel.hidden` (the declarative collapsed state the trait reads on upgrade).
- **E2E (`fui:plugs/__tests__/e2e/navigation.spec.ts`)** — new `menubar coordinator` describe over the #943 demo fixture, proving
  trait composition **in a real browser** (the half jsdom can't reach — it strips the colon-attr prefix):
  asserts `nav:menubar` + `nav:section` are registry-**upgraded** (aria-controls/aria-expanded wired), then
  the four coordinator behaviors — **open**, **sibling-exclusive close**, **Escape→collapse**, **outside
  dismiss**. Fixed the demo fixture layout (wrapped each head+panel in a positioned `.menubar-section` so
  the dropdown anchors under its own head) — found by the e2e itself (an open panel was overlaying the
  sibling head). **16/16 navigation e2e pass**, full FUI suite 921 unit + gate green.

**Closes #934** — every build slice (#941/#942/#943/#944/#945) plus this verification is landed; the
disclosure navs now compose `nav:section`/`nav:menubar` instead of hand-rolling, end-to-end.
