---
kind: story
size: 5
locus: frontierui
status: open
blockedBy: []
dateOpened: "2026-06-21"
tags: [explorer, regression, fixtures, frontierui, smoke]
---

# Explorer self-regression: browser smoke-lane run of the LIVE explorer over served fixtures (+ axe-a11y / focus-trap / multi-page fixtures)

The browser-lane half of #1421. #1421 built the fixture gallery (fui:tools/explorer/fixtures/*.html), the
data-driven expectation manifest (fui:tools/explorer/fixtures/manifest.ts), and the unit-lane suite
(fui:tools/explorer/__tests__/fixtures.test.ts) that pins the oracle DECISION layer (where heuristics like
#1412 regress) — running in the fast happy-dom `check:standards` lane.

This slice adds the end-to-end guard that needs a real browser (the Playwright smoke lane, like
fui:tools/explorer/__tests__/gate.smoke.spec.ts):

1. Serve each fixture and run the **live EXPLORE profile** over it (real getComputedStyle/scrollWidth +
   real axe), asserting findings == manifest expectation — proving the collector→oracle wiring, not just
   the pure decision layer.
2. Add the fixtures that need a real browser: an **axe a11y violation**, a **focus trap**, an
   **HTTP 5xx** resource, scroll-only-reachable content + drag-exposed overflow (post-#1418), and a
   **multi-page** fixture (the #1422 nav-crash guard end-to-end).
3. Extend the manifest with these and keep the unit-lane suite as the fast first line.

Gate in frontierui (the smoke/e2e lane + `npm run check:standards`). Minimal, deterministic, bounded
(#1421 scope 5).
