---
kind: story
size: 3
parent: "2555"
status: open
dateOpened: "2026-08-01"
tags: []
---

# Remove the all-37 card-state reference gallery from the live console board

The operator ruled the all-37 reference gallery does not belong on the operational board at all (it is a conformance/review artifact). Remove `renderStateGallery()` (plateau-app:src/backlog-view/lane-board.ts ~496-521), its call site (~1503), the `reference` chip (~1147) + its click wiring (~1624-1626), and the `.lb-gallery`/`.lb-gallery-sum` CSS (plateau-app:src/backlog-view/lane-board.css ~536-537). Relocate the two plateau-app:src/backlog-view/lane-board.test.ts assertions (§6e-all-37 ~591, failure-axis UC-E1 ~722) to render via `renderCaseCell` directly and/or lean on the maintained `plateau-app:src/backlog-view/card-taxonomy.webcases.test.ts` conformance spec — the all-37 coverage guarantee must not be lost. Re-baseline the /console-board visual snapshot if one exists. The 37 card-state cases are documented on the /console-cases web-cases page, not the operational board.
