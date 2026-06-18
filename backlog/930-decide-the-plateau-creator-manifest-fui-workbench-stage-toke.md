---
type: decision
workItem: story
size: 2
parent: "746"
status: open
relatedProject: webdocs
dateOpened: "2026-06-18"
tags: [block-explorer, plateau-embed, theme-creator, design-system]
---

# Decide the Plateau-creator manifest -> FUI workbench-stage token bridge (live-apply fidelity)

Surfaced by #751. #887-A ratified the postMessage *transport*, not the *semantic* bridge. The Plateau
creator authors **DTCG tokens** (`plateau:plateau-app/src/design-system-creator/provider.ts` — color/space
keys + a radius trait); FUI's stage applies **5 fixed props** (`fui:frontierui/workbench/designSystems.ts`
`DesignSystemTokens`: `--wb-accent/--wb-radius/--wb-pad/--wb-font/--wb-shadow`, consumed by
`applyDesignSystem` at `fui:frontierui/workbench/mount.ts:277`). The mapping is undefined and lossy
(`--wb-font`/`--wb-shadow` have no creator source). **Fork:** A) a lossy DTCG→`--wb` mapping table in the
FUI receiver (ships now); B) the stage consumes DTCG directly (faithful, larger); C) constrain the creator
to the `--wb` shape (aligns both, limits the creator). Lean **A**; revisit B as the stage matures. Blocks #751.
