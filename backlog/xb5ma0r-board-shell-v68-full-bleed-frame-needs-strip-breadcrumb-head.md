---
kind: story
size: 8
parent: "2555"
status: resolved
locus: plateau-app
scaffoldedBy: "conveyor-board-shell"
dateScaffolded: "2026-07-27"
dateStarted: "2026-07-27"
dateOpened: "2026-07-27"
dateResolved: "2026-07-27"
graduatedTo: "plateau-app:src/backlog-view/lane-board.ts (v68 shell: breadcrumb + needs-strip + rails + exec-plan) + composer.ts + lane-board.css + src/styles/pages.css"
tags: [plateau-loop, console, console-board, shell, port-mock, slice-2555]
---

# Board shell -> v68: full-bleed frame, needs-strip, breadcrumb header, right-rail ready-to-queue, left-rail glossary, exec-plan controls, slim composer

Rework the launch-review lane-board SHELL in plateau-app to converge visually with the ratified v68 mock
(`plateau-app:tests/visual/baselines/board.png`). The center card/lane machinery already matches once
populated — this slice touches only the frame around it. Deltas closed: (1) render FULL-BLEED (drop the
`.page` max-width/centre trap; let the content region scroll, no inner-scroll box); (2) add the top
NEEDS-STRIP pill row (waiting-on-you · building · paused · stalled · next · live/freshness); (3) replace the
h1+description+legend header with a BREADCRUMB (Constellation / Plateau Loop) plus a right control cluster
(reference · lane summary · zoom · overflow); (4) move READY-TO-QUEUE into a ~320px RIGHT RAIL with
tree/Σ badges, ⚡ frees counts, overlap/category tags and prepare buttons on gated items; (5) add the
"HOW THIS BOARD WORKS" GLOSSARY panel to the left rail; (6) frame the center as "EXECUTION PLAN" + scope
subtitle + controls (simulate · sized · hints · lane-nav · zoom); (7) slim the COMPOSER to a compact
segmented form in the narrow left rail; (8) dial back accent saturation to the mock's sparing purple.
Locus plateau-app (impl); resolve lands in WE (cross-locus couple).

## Progress
- Built in a plateau-app lane clone against the running dev server; visual self-reviewed vs the committed
  `board.png` baseline (light + dark) with the #2670 comparator to convergence.
</content>
</invoke>
