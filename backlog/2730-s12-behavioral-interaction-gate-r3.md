---
bornAs: x09lsj3
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2725", "2729", "2723", "2724"]
scope: ["plateau-app:src/feature-tracker/feature-tracking.behavior.test.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S12 · Behavioral / interaction gate (R3)

The 'identical DOM, dead wiring' catcher after the S2 registry refactor: expand-all, theme-toggle SVG redraw, DAG/ranked cross-nav, filter-to-zero clear-filter, aria-activedescendant nav, tab nav, banner jump, and the window-edge keyboard case. Runs green in jsdom or Playwright against the running :4000 dev server.

## Deliverable
The "identical DOM, dead wiring" catcher after the S2 registry refactor: expand-all opens every section; the theme toggle redraws every SVG (token colours change); DAG-node + ranked-row cross-nav selects the target; filter → zero shows clear-filter and it returns to All; aria-activedescendant arrow/Home/End/Enter move+select; tab arrow/Home/End; the banner jump opens Dependencies on the blocker. Window-edge keyboard case (R8): nav across the virtualization boundary keeps focus + selection correct.

## FT cases → rendered=yes
Behavioral coverage — no new render.

## Scope
- `plateau-app:src/feature-tracker/feature-tracking.behavior.test.ts`

## Acceptance
Every interaction above is asserted to actually fire (not just present in DOM); runs green in jsdom (or Playwright against the running :4000 dev server, never restarted); the window-edge case passes.
