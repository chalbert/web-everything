---
bornAs: xg4lsxj
kind: task
parent: "2555"
status: resolved
blockedBy: ["2789", "2795"]
dateOpened: "2026-07-28"
dateStarted: "2026-07-31"
dateResolved: "2026-07-31"
graduatedTo: none
scope:
  - plateau-app:tests/visual/baselines/board.png
  - plateau-app:tests/visual/baselines/board-1280.png
  - plateau-app:tests/visual/baselines/board-1680.png
  - plateau-app:tests/visual/baselines/PROVENANCE.md
  - plateau-app:tests/visual/baselines/sources/board.html
  - plateau-app:tests/visual/board.visual.spec.ts
  - plateau-app:tests/visual/capture.mjs
  - plateau-app:tests/visual/render-baselines.mjs
  - plateau-app:tests/visual/README.md
tags: [plateau-loop, console, console-board, visual-baseline, gate, canonical-2554, slice-2555]
---

# Regenerate the console-board visual baseline from the §6/#2554 canonical artifact and retire v68

Delivered in [chalbert/plateau-app#128](https://github.com/chalbert/plateau-app/pull/128).

Every stale story fails at the same root: `plateau-app:tests/visual/baselines/board.png` (the **v68** render)
is still the pass/fail oracle, and the canonical artifact supersedes it. Regenerate the baseline from the
ratified §6/#2554 canonical artifact and retire v68 as the comparator.

## Why (canonical gap)
The committee (2026-07-28) identified this as the single fix that unblocks the whole re-anchor: [#2710],
[#2711], [#2713], [#2714], [#2715] all measure acceptance against v68 `board.png`. While that render is the
oracle, a green result can still miss canon. Re-baseline once, and the stale stories become checkable against
the right target.

## Sequencing (why blockedBy the foundations)
Do **not** flip the oracle before the board renders to canon — a canonical baseline against a not-yet-canonical
board reds the whole visual gate mid-flight. Land the card-grammar core [#2789] and the token foundation
[#2795] first (both themes), then regenerate. Center-realization stories ([#2713], [#2793]) should be
in place or the regenerated regions accepted as intentionally-red-until-built.

## Scope
- Regenerate `plateau-app:tests/visual/baselines/board.png` (and the `BOARD`/`POOL`/`SPANS` fixture regions)
  from the ratified §6/#2554 canonical artifact at the ratified widths (1280 / 1440 / 1680).
- Retire the v68 render as the comparator; update any story/doc that cites "v68 board.png" to cite the
  canonical reference.
- Record the artifact ↔ baseline provenance so the oracle's origin is traceable.

## Acceptance
The visual comparator measures the board against a baseline generated from the canonical §6/#2554 artifact; no
test or story still treats the v68 render as the oracle. `plateau-app` visual suite + `we:` `check:standards`
pass (or the intentionally-red regions are explicitly gated to their owning unbuilt story).

## Resolution (2026-07-31)
Adversarially reviewed [chalbert/plateau-app#128](https://github.com/chalbert/plateau-app/pull/128) from a
fresh clone on the PR branch (`lane/2796-console-board-visual-baseline`, base `24dc9bd`):

- **Generation traces to canon, not a hand-faked render.** `plateau-app:tests/visual/render-baselines.mjs`
  boots a throwaway `vite` dev server and screenshots the LIVE `/console-board?demo=1` route —
  `mountLaneBoard`'s real render in `plateau-app:src/backlog-view/lane-board.ts`, painting the actual
  `BOARD`/`POOL`/`SPANS`/`READY` fixtures — at the three ratified widths (1280/1440/1680). The old
  hand-authored mock, `plateau-app:tests/visual/baselines/sources/board.html` (the v68 export), is deleted
  from the tree, not merely superseded.
- **The captured board reflects canon.** All 13 §6/#2554 convergence items the baseline depends on
  ([#2789], [#2790], [#2791], [#2792], [#2793], [#2794], [#2795], [#2710], [#2711], [#2712], [#2713], [#2714],
  [#2715]) are `status: resolved` on `main` as of the PR's base commit — the board it captured had already
  converged to canon.
- **Provenance is honest.** `plateau-app:tests/visual/baselines/PROVENANCE.md` records the exact source route,
  fixtures, generator, widths, and the base commit the render was taken from, plus why it replaces the v68
  mock.
- **The visual suite passes.** `npm test` (vitest): 119 files / 1685 tests green, matching the PR's claim.
  `npx playwright test tests/visual` initially timed out 2/5 under a plain `npm start` dev server — traced to
  the documented Vite-HMR-websocket `networkidle` flakiness the repo's own CI comment calls out, NOT a defect
  in the PR. Rerun the CI way (`npm run build` + `vite preview` + `PLATEAU_PREBUILT_APP=1`): **5/5 green**,
  matching the PR's claim exactly. Independently regenerated the baseline with the PR's own script and
  pixel-diffed it against the committed PNGs: the only drift (≈0.03% of pixels, mean delta 0.017) traces to a
  mid-animation spinner icon frame, well under the shared comparator's antialiasing tolerance — not a content
  divergence.
- **v68 retired as the visual oracle.** `plateau-app:tests/visual/baselines/sources/board.html` is deleted;
  every remaining "v68" mention in the tree (`plateau-app:tests/visual/baselines/PROVENANCE.md`,
  `plateau-app:tests/visual/README.md`, code comments, `plateau-app:docs/backlog-console-design.md`) is a
  historical note explaining the retirement, never a live pointer treating it as the current comparator.

Cleared the review park: `review:pending`/`ready-to-merge` → `review:accepted` (committee-tier, producer-
certified baseline with green checks). Parent [#2555] still has open children ([#2587], [#2588], [#2797]) —
no epic rollup.
