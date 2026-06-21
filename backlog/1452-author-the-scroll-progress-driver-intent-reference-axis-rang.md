---
kind: story
size: 3
status: open
dateOpened: "2026-06-21"
tags: []
---

# Author the scroll-progress driver intent (reference/axis/range, native CSS lowering + JS fallback)

Realizing work for the ratified #1407 placement call: author `we:src/_data/intents/scroll-progress.json` — a continuous 0..1 scroll-progress driver intent homed in webintents. Owns reference (`scroll()` track vs `view()` element), axis (default block, exposed), and range (named `animation-range`: entry/exit/cover/contain). Lowers to native CSS Scroll-driven Animations (`animation-timeline`) where supported, `@supports` + JS (ScrollTimeline/IO) fallback elsewhere; composes the motion intent so `prefers-reduced-motion` yields a static end-state. Rewire `animation-orchestration`'s `trigger: on-scroll` gloss in `we:src/_data/intents/animation-orchestration.json` to cite it (opaque start condition becomes driven by scroll-progress). Add a demo (reading-progress bar + parallax reveal). Author via /new-standard.
