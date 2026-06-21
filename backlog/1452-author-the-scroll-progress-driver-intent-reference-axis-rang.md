---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/scroll-progress.json"
tags: []
---

# Author the scroll-progress driver intent (reference/axis/range, native CSS lowering + JS fallback)

Realizing work for the ratified #1407 placement call: author `we:src/_data/intents/scroll-progress.json` — a continuous 0..1 scroll-progress driver intent homed in webintents. Owns reference (`scroll()` track vs `view()` element), axis (default block, exposed), and range (named `animation-range`: entry/exit/cover/contain). Lowers to native CSS Scroll-driven Animations (`animation-timeline`) where supported, `@supports` + JS (ScrollTimeline/IO) fallback elsewhere; composes the motion intent so `prefers-reduced-motion` yields a static end-state. Rewire `animation-orchestration`'s `trigger: on-scroll` gloss in `we:src/_data/intents/animation-orchestration.json` to cite it (opaque start condition becomes driven by scroll-progress). Add a demo (reading-progress bar + parallax reveal). Author via /new-standard.

## Progress (batch-2026-06-21)

- Authored `we:src/_data/intents/scroll-progress.json` (status active) — dimensions `reference`
  (scroll/view), `axis` (block default, exposed: block/inline/x/y), `range` (named animation-range:
  cover/contain/entry/exit); description covers native-first lowering (CSS Scroll-driven Animations +
  `@supports`/JS fallback) and Motion composition (reduced-motion → static end-state). Borrows official
  platform vocabulary (`animation-timeline`, `animation-range`). Dropped a `requiresCapabilities` ref to a
  non-existent capability (kept the field off, per the minimal-intent shape).
- Rewired `we:src/_data/intents/animation-orchestration.json` `trigger: on-scroll` gloss to cite the new
  intent — the opaque start condition is now the driven 0..1 value scroll-progress owns.
- Demo `we:demos/scroll-progress-demo.html` + `.css` + registry `we:src/_data/demos/scroll-progress-demo.json`:
  a reading-progress bar (reference: scroll) + parallax reveal card (reference: view, range: cover),
  native `animation-timeline: scroll()/view()` behind `@supports` with a JS scroll-handler /
  IntersectionObserver fallback, and a reduced-motion static end-state. The `role="progressbar"`
  `aria-valuenow` tracks on BOTH paths (status value stays correct even when CSS paints the fill).
- Regenerated `we:AGENTS.md` (gen:inventory) for the +1 intent / +1 demo. Verified live: demo renders on
  :3000 (native lowering detected, aria-valuenow 0→100 on scroll), intent page 200 on :8080.
  `check:standards` → 0 errors. (A pre-existing concurrent 500 on the injected `fui:blocks/navigation`
  bootstrap hits every demo identically — not this changeset.)
