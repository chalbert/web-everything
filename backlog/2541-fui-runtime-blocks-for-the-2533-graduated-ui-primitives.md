---
bornAs: xpex0n8
kind: epic
status: open
locus: frontierui
dateOpened: "2026-07-18"
tags:
  - frontier-ui
  - implementation
  - console-board
  - ui-primitives
  - "2533-graduation"
---

# FUI runtime blocks for the #2533-graduated UI primitives

Decision [#2533](/backlog/2533-console-board-derived-ui-standards.md) graduated four UI-primitive standards, now landed **spec-only** in Web Everything (WE holds zero impl):

- [#2534](/backlog/2534-mint-the-scale-ruler-foundational-scale-primitive.md) — `scale-ruler` intent (`we:src/_data/intents/scale-ruler.json`)
- [#2536](/backlog/2536-mint-the-semantic-zoom-level-of-detail-intent.md) — `semantic-zoom` intent (`we:src/_data/intents/semantic-zoom.json`)
- [#2535](/backlog/2535-extend-progress-with-optional-secondary-comparison-track.md) — `progress.secondaryTrack` dimension (`we:src/_data/intents/progress.json`)
- [#2537](/backlog/2537-add-a-swimlane-layout-mode-to-the-web-graph-standard.md) — Web Graph `swimlane` LayoutStrategy (`we:contracts/graph.ts`)

Each is a UX contract with **no runnable implementation** — the `intent → block` chain dead-ends at the intent until Frontier UI ships a block that `implementsIntent`. This epic tracks that impl layer explicitly, rather than leaving it implicit under the board build. The **consumer** driving the demand is the plateau console board ([#2505](/backlog/2505-plateau-loop-operable-backlog-console-built-fresh-in-plateau.md)), which renders all four; FUI must implement them for the board to compose ratified blocks instead of app-custom UI.

**Boundary reminder:** the contracts crossed the WE→FUI seam in #2534–2537; the runtime does not cross back. Impls live in `fui:blocks.json` + `fui:` block-descriptions, never in WE.

**Children (build order — scale-ruler first, the foundational layer #2537's board sits on):**
1. FUI block for the `scale-ruler` intent
2. FUI block for the `semantic-zoom` intent
3. Extend the FUI `progress` block with the secondary/comparison track
4. Add the `swimlane` layout to the FUI graph layout impl

**Acceptance (epic):** every child resolved — each of the four standards has a Frontier UI block (or block extension) that `implementsIntent`/realizes the contract, registered in `fui:blocks.json`, passing the render-conformance loop; the console board consumes them.
