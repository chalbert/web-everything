---
type: idea
workItem: story
size: 3
parent: "315"
status: resolved
dateStarted: "2026-06-12"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: block:carousel
tags: []
---

# Carousel block

Carousel block — horizontally-paged content set with paging controls, optional autoplay, and WAI-ARIA APG carousel keyboard + accessibility. Gap from the competitive coverage analysis (#347): no carousel block; CSS scroll-snap is the native anchor. Related to the webscroll project (#014). Candidate from the gap sweep — groom before building.

## Outcome (2026-06-12)

Authored the `carousel` block standard (status `draft`, type Component, composes motion/live-region-status/
navigation). Verified genuinely uncovered (no carousel/scroll-snap block; webscroll #014 is a scroll project).
Native-first: substrate is a CSS scroll-snap container, with the emerging CSS carousel pseudo-elements
(::scroll-button(), ::scroll-marker — Open UI / CSS Overflow 5) as native controls where shipped; JS paging
is the fallback only. 4 design decisions (scroll-snap baseline + CSS-carousel frontier · mandatory APG a11y ·
autoplay opt-in + WCAG 2.2.2 gated · equivalent-slides-not-tabs/data boundary). `fui:blocks.json` +
`we:block-descriptions/carousel.njk` + semantics term *Carousel*. Coverage: carousel → covered. `check:standards`
green; page at `/blocks/carousel/`.
