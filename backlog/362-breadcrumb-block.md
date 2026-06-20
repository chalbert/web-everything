---
kind: story
size: 2
parent: "315"
status: resolved
dateStarted: "2026-06-12"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: block:breadcrumb
tags: []
---

# Breadcrumb block

Breadcrumb block — structured hierarchical location trail (nav[aria-label], current-page marking, overflow collapse on small viewports). Gap from the competitive coverage analysis (#347): navigation primitives (block:nav-list, intent:navigation) exist but no breadcrumb block composes them. Candidate from the gap sweep.

## Outcome (2026-06-12)

Authored the `breadcrumb` block standard (status `draft`, type Component, `implementsIntent: navigation`,
composes typography). Verified genuinely uncovered first (nav-list is APG Disclosure *menus*, not a trail;
navigation intent only mentions breadcrumb in a passing truncation note). Native-first: it IS a
`nav[aria-label="Breadcrumb"]` + ordered list with `aria-current="page"` on the current crumb; the block
adds only overflow-collapse and responsible truncation. 4 design decisions (native landmark+list ·
presentational separators · collapse-not-wrap overflow · location-vs-menu/tabs/stepper boundary).
`fui:blocks.json` + `we:block-descriptions/breadcrumb.njk` (Web Standards + Framework Research tables, structure,
behaviour, boundaries) + semantics term *Breadcrumb*. Coverage data corrected (breadcrumb → covered).
`check:standards` green; page verified at `/blocks/breadcrumb/`.
