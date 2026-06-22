---
kind: decision
status: open
dateOpened: "2026-06-22"
tags: []
---

# Dev-tool placement across the constellation — devtools belong in Plateau, not FUI

User ruling (2026-06-22): **dev-tools belong in Plateau (plateau-app), not FUI.** Review where ALL
dev-tools currently live across the constellation and relocate per that rule. Today's state is mixed and
conflicting, which is why a sweep (not a one-line move) is needed. Blocks [#1553](/backlog/1553/): the
trainable-judge Fork 3 constellation boundary assumes where the explorer/judge live.

## The principle (given)

Dev-tools → Plateau. The constellation layers are: **WE** = standards/contracts (zero impl, #1282) ·
**FUI** = the reference *implementation* of the standards (components) · **Plateau** = the *product*
layer — and dev-tools are product-shaped, so they belong with Plateau, not bundled into the
reference-impl. This ruling is the frame; the per-tool work is classification + relocation.

## What the review must do

1. **Inventory every dev-tool** across WE / FUI / plateau-app (starter set below — complete it).
2. **Classify each:** genuine dev-tool (→ Plateau) vs reference-impl that only *looks* like tooling
   (stays FUI) vs already-correct. The edge cases are the work — e.g. a tool that *is* a conformance
   verifier reading output as DATA may lean WE (`project_conformance_verifier_vs_subject`).
3. **Codify** the devtools→Plateau rule in `we:docs/agent/platform-decisions.md` (the resolve gate
   requires `--codified-to`).
4. **Spawn per-tool relocation slices** (separate items; this decision rules placement, the moves are
   downstream build work).

## Starter inventory (incomplete — extend during the review)

- **Autonomous explorer** — `frontierui/tools/explorer/` (44 files), epic [#1552](/backlog/1552/) loci'd
  `frontierui`. The direct trigger (via #1553). → likely Plateau.
- **Workbench / block-explorer** — currently **FUI-owned** ([#809](/backlog/809/),
  `project_block_explorer_chrome_decoupled_from_distribution`). Tension: it's called a "FUI-owned
  *product*" — reconcile against devtools→Plateau.
- **Spec-explorer / dev-panel Vite plugin** — **duplicated** across WE :3000 and FUI :3001
  (`project_dev_panel_plugin_duplicated`). Relocation could also de-duplicate it.
- **Technical Configurator** — already plateau-app (`project_technical_configurator`) — likely
  already-correct; confirm.

## Decided

_Pending. Record the devtools→Plateau ruling + the per-tool placement table + the `codifiedIn` anchor;
then unblock [#1553](/backlog/1553/) and scaffold the relocation slices._
