---
kind: story
size: 5
status: resolved
blockedBy: ["609", "643"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "intent:disclosure surface dimension (in-flow|anchored) + recipe on block:nav-list + demo:reveal-nav-conformance — reveal-nav composition recipe graduated (#609 Fork 1A), all 5 APG invariants pass"
relatedProject: webintents
relatedReport: reports/2026-06-14-reveal-navigation-disclosure-pattern.md
tags: [navigation, disclosure, reveal-nav, nav-list, anchor, conformance-demo, graduation]
---

# Graduate the reveal-nav composition recipe — nav-list out-of-flow surface value + conformance demo

Ratified by #609 Fork 1A: the reveal navigation panel (mega-menu / dropdown nav) is a documented composition recipe, NOT a new block — homed on nav-list. Two pieces: (1) express the out-of-flow anchored panel as a surface-strategy value on nav-list's existing disclosure axis (in-flow accordion vs anchor strategy=escape/type=menu panel); (2) ship a conformance demo proving the recipe (nav-list section + disclosure + anchor escape + the #643 hover-intent concern) against the APG Disclosure-Navigation invariants — disclosure-not-menu, no-reflow, i18n label-growth, native-first CSS baseline + JS enhancement. This recipe + demo IS the standard.

## Progress

- **Piece 1 — surface-strategy value:** added a `surface` dimension to the [disclosure intent](/intents/disclosure/) (`we:src/_data/intents.json`, text-spliced): `in-flow` (accordion baseline — expands in document flow) vs `anchored` (out-of-flow escaped panel — the reveal-nav recipe, composing anchor `strategy=escape`/`type=menu`). This is the standards artifact that makes the out-of-flow panel expressible.
- **Piece 1b — recipe documented on nav-list:** appended a "Composition recipe: reveal navigation" section to [we:src/_includes/block-descriptions/nav-list.njk](/src/_includes/block-descriptions/nav-list.njk) — reveal-nav = nav-list section + disclosure `surface:anchored` + anchor escape/menu + #643 hover-intent; explicitly a disclosure, NOT an ARIA menu; native-first CSS baseline + JS enhancement.
- **Piece 2 — conformance demo:** [we:demos/reveal-nav-conformance.html](/demos/reveal-nav-conformance.html) + `.ts` + `.css` (registered in [we:src/_data/demos.json](/src/_data/demos.json)). Shows the anchored reveal-nav (native `popover` + CSS anchor positioning, hover-intent JS enhancement with deliberate-open/forgiving-travel) alongside the in-flow accordion (the two surface values), and runs the APG Disclosure-Navigation invariant checks into a pass/fail table.
- **Verified in a real browser** (Playwright against the running Vite :3000): all 5 invariants PASS — disclosure-not-menu, no-reflow (out-of-flow), i18n label-growth, native-first CSS baseline, JS enhancement (state synced); no console errors.
- `check:standards` green (intents 56, demos 27); `tsc --noEmit` clean for the demo; 11ty build smoke green.
