---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["609", "643"]
dateOpened: "2026-06-14"
relatedProject: webintents
relatedReport: reports/2026-06-14-reveal-navigation-disclosure-pattern.md
tags: [navigation, disclosure, reveal-nav, nav-list, anchor, conformance-demo, graduation]
---

# Graduate the reveal-nav composition recipe — nav-list out-of-flow surface value + conformance demo

Ratified by #609 Fork 1A: the reveal navigation panel (mega-menu / dropdown nav) is a documented composition recipe, NOT a new block — homed on nav-list. Two pieces: (1) express the out-of-flow anchored panel as a surface-strategy value on nav-list's existing disclosure axis (in-flow accordion vs anchor strategy=escape/type=menu panel); (2) ship a conformance demo proving the recipe (nav-list section + disclosure + anchor escape + the #643 hover-intent concern) against the APG Disclosure-Navigation invariants — disclosure-not-menu, no-reflow, i18n label-growth, native-first CSS baseline + JS enhancement. This recipe + demo IS the standard.
