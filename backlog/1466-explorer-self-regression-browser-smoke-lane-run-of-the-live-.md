---
kind: story
size: 5
locus: frontierui
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:tools/explorer/__tests__/fixtures.smoke.spec.ts"
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

## Progress (batch-2026-06-21)

- **Browser smoke lane** `fui:tools/explorer/__tests__/fixtures.smoke.spec.ts` — for each `browserLane`
  fixture it runs the LIVE EXPLORE profile (`sweepSite` → real collector → oracle bus) over the served
  fixture and asserts the fired oracles ⊇ the manifest's `expectOracles`, proving the collector→oracle
  wiring (not just the pure decision layer); clean controls must not trip any structural oracle (the #1412
  false-positive guard). Plus the multi-page nav guard (#1422 end-to-end). **9/9 pass on :3001 (7.9s).**
- **New browser-needing fixtures** `fui:tools/explorer/fixtures/`: `axe-a11y-violation.html` (real axe
  `image-alt`), `focus-trap.html` (dead-end stuck focus), `scroll-residue.html` (clipped-but-scrollable
  y-residue, #1418/#1465), `multi-page-hub.html` + `multi-page-leaf.html` (nav-crash guard). Existing
  console-error/overflow/clean fixtures also marked `browserLane`.
- **Manifest** `fui:tools/explorer/fixtures/manifest.ts` — extended `FixtureSignals` with `clippedResidue`,
  `FixtureScenario` with `browserLane`, and added the 4 new scenarios; the unit-lane `observationFor`
  (`fui:tools/explorer/__tests__/fixtures.test.ts`) now carries `clippedResidue` through. Unit lane 12/12.
- **HTTP-5xx note (no silent drop):** the 5xx case stays unit-lane only — a static fixture server has no
  deterministic 500 route to reproduce it in the browser; documented on the `browserLane` field.
- FUI `check:standards` → 0 errors; typecheck clean.
