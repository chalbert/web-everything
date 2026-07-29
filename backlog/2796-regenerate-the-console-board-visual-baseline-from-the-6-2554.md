---
bornAs: xg4lsxj
kind: task
parent: "2555"
status: open
blockedBy: ["2789", "2795"]
dateOpened: "2026-07-28"
tags: [plateau-loop, console, console-board, visual-baseline, gate, canonical-2554, slice-2555]
---

# Regenerate the console-board visual baseline from the §6/#2554 canonical artifact and retire v68

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
