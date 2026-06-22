---
kind: epic
status: open
blockedBy: []
childlessReason: program
dateOpened: "2026-06-21"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-21-1442-split-analysis.md
tags: [packaging, custom-elements, block-model, conversion, frontierui]
---

# Block-model conversion: register remaining blocks as custom elements (per-block mechanism)

Separately-prioritized build epic spun out of #1381. End-state already ruled by #1321: every block becomes a custom element, mechanism chosen per use case, applying the #1381 mechanism-selection guideline (codified we:docs/agent/block-standard.md Packaging governance §7): default S1/native-first; behavior-free presentational control -> transient (A); framework-bound/reactive block -> persistent light-DOM (B); block facing hostile/unknown host CSS opting into #1349 S2 -> shadow (C). Drained incrementally, sequenced by normal burndown ordering.

## Slicing (split analysis we:reports/2026-06-21-1442-split-analysis.md)

The real FUI tree (we:reports/2026-06-21-1442-split-analysis.md) shows blocks in four families, with all three mechanism reference patterns already shipping (A=fui:blocks/transient/TransientElement.ts:28, B=fui:blocks/wizard/WizardElement.ts:25, C=fui:blocks/story-canvas/StoryCanvasElement.ts:49) — so conversions are flat applications with no DAG roots to sequence. First batchable wave carved as slices; the ~50-block mechanical tail stays an incremental burndown (pre-scaffolding it adds review overhead with zero gain — filed per pickup); two genuine per-block forks de-buried into their own decision cards.

- **#1453** — convert button → `we-button` (transient/A); the #1381-named reference application, still unbuilt.
- **#1454** — convert badge → `we-badge` (transient/A).
- **#1455** — convert card → `we-card` (transient/A).
- **#1456** *(decision)* — grouped form-control packaging mechanism (A vs B); gates checkbox/radio-group + single-input form participation.
- **#1457** *(decision)* — behavior blocks (stepper/deck/tabs): we- element vs stay CustomAttribute behaviors.

Remaining catalog blocks are filed as picked up, classified by the guideline above.
