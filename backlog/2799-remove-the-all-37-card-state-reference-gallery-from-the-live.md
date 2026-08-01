---
bornAs: xzczsx7
kind: story
size: 3
parent: "2555"
status: resolved
dateOpened: "2026-08-01"
dateStarted: "2026-08-01"
dateResolved: "2026-08-01"
graduatedTo: none
scope:
  - plateau-app:src/backlog-view/lane-board.ts
  - plateau-app:src/backlog-view/lane-board.css
  - plateau-app:src/backlog-view/lane-board.test.ts
  - plateau-app:docs/backlog-console-design.md
  - plateau-app:tests/visual/baselines/board.png
  - plateau-app:tests/visual/baselines/board-1280.png
  - plateau-app:tests/visual/baselines/board-1680.png
tags: []
---

# Remove the all-37 card-state reference gallery from the live console board

> **DELIVERED — plateau-app PR [#130](https://github.com/chalbert/plateau-app/pull/130).** Removed
> `renderStateGallery()`, its `mountLaneBoard` call site, the header "reference" chip
> (`data-ref-gallery`) + its click wiring, and the now-dead `.lb-gallery`/`.lb-galfam`/`.lb-chip` CSS
> from plateau-app:src/backlog-view/lane-board.ts and plateau-app:src/backlog-view/lane-board.css.
> Exported the previously-private `renderCaseCell()` helper so the two
> plateau-app:src/backlog-view/lane-board.test.ts assertions that depended on `renderStateGallery`
> (the §6e all-37-states grammar-conformance suite, and one failure-axis UC-E1 check) could be
> relocated to iterate `renderCaseCell` over the maintained
> plateau-app:src/backlog-view/card-taxonomy.webcases.ts cases directly — the all-37 coverage
> guarantee is unchanged, only its entry point moved. Regenerated the `/console-board` visual
> baseline (`board.png`, `board-1280.png`, `board-1680.png`) via
> plateau-app:tests/visual/render-baselines.mjs, the same generator [#2796] used; the Playwright
> visual suite (5/5) and the `npm test` unit suite (119 files / 1685 tests) are both green. The 37
> card-state cases remain documented — on the separate `/console-cases` web-cases page, not the
> operational board.

The operator ruled the all-37 reference gallery does not belong on the operational board at all (it is a conformance/review artifact). Remove `renderStateGallery()` (plateau-app:src/backlog-view/lane-board.ts ~496-521), its call site (~1503), the `reference` chip (~1147) + its click wiring (~1624-1626), and the `.lb-gallery`/`.lb-gallery-sum` CSS (plateau-app:src/backlog-view/lane-board.css ~536-537). Relocate the two plateau-app:src/backlog-view/lane-board.test.ts assertions (§6e-all-37 ~591, failure-axis UC-E1 ~722) to render via `renderCaseCell` directly and/or lean on the maintained `plateau-app:src/backlog-view/card-taxonomy.webcases.test.ts` conformance spec — the all-37 coverage guarantee must not be lost. Re-baseline the /console-board visual snapshot if one exists. The 37 card-state cases are documented on the /console-cases web-cases page, not the operational board.
