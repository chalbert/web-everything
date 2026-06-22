---
kind: epic
status: open
blockedBy: []
dateOpened: "2026-06-21"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-21-1442-split-analysis.md
tags: [packaging, custom-elements, block-model, conversion, frontierui]
---

# Block-model conversion

Register the remaining blocks as custom elements, mechanism chosen per block. Separately-prioritized build epic spun out of #1381. End-state already ruled by #1321: every block becomes a custom element, mechanism chosen per use case, applying the #1381 mechanism-selection guideline (codified we:docs/agent/block-standard.md Packaging governance §7): default S1/native-first; behavior-free presentational control -> transient (A); framework-bound/reactive block -> persistent light-DOM (B); block facing hostile/unknown host CSS opting into #1349 S2 -> shadow (C). Drained incrementally, sequenced by normal burndown ordering.

## Slicing (split analysis we:reports/2026-06-21-1442-split-analysis.md)

The real FUI tree shows blocks in four families, with all three mechanism reference patterns already shipping (A=fui:blocks/transient/TransientElement.ts:28, B=fui:blocks/wizard/WizardElement.ts:25, C=fui:blocks/story-canvas/StoryCanvasElement.ts:49) — so conversions are flat applications with no DAG roots to sequence. This is a **finite burndown epic, not a program**: it has a Definition of Done (every block converted) and resolves when the catalog is drained. Its remaining scope sits in the batch pool as open `tracking` slices, carved in waves; it is never flagged "to resolve" because open children remain (no `childlessReason: program` hack).

**Wave 1** (we:reports/2026-06-21-1442-split-analysis.md) — both per-block forks now resolved:

- **#1453** — convert button → `we-button` (transient/A); the #1381-named reference application.
- **#1454** — convert badge → `we-badge` (transient/A).
- **#1455** — convert card → `we-card` (transient/A).
- **#1456** *(decision, resolved)* — grouped form-control packaging → **B (persistent light-DOM group)**.
- **#1457** *(decision, resolved)* — behavior blocks (stepper/deck/tabs) → support-both; built via #1489/1490/1491.

**Wave 2** (we:reports/2026-06-22-1442-slice-wave-2.md):

- **#1540** — convert meter → `we-meter` (transient/A).
- **#1541** — convert progress → `we-progress` (transient/A).
- **#1542** — convert checkbox → `we-checkbox` + `we-checkbox-group` (persistent/B, #1456).
- **#1543** — convert radio → `we-radio` + `we-radio-group` (persistent/B, #1456).

Remaining catalog blocks (single inputs, stateful/interactive blocks) are carved as later waves on pickup; headless "can-do" behaviors stay CustomAttribute behaviors (out of scope). When the last wave lands, resolve the epic.
