---
kind: story
size: 5
parent: "099"
status: open
locus: frontierui
blockedBy: []
relatedProject: webintents
dateOpened: "2026-06-21"
tags: [edit-in-place, inline-edit, editing, fui, realizing-build]
---

# FUI edit-in-place behavior block + demo + data-grid editable-cell wiring (realizes #1397 intent #1439)

The FUI realization half of the #1397 ruling, carved off #1439 (which minted the WE intent
`we:src/_data/intents/edit-in-place.json`). The intent contract now exists and is unblocked; this slice
builds its realization in frontierui:

1. A **FUI behavior block** realizing the edit-in-place intent — the activation gesture (click/dblclick/
   F2/programmatic per the `activation` dimension), the display-renderer⇄editor-renderer swap for one
   atomic value, and commit (`commitOn`: blur/enter/explicit) / cancel-revert-to-baseline (`cancelOn`:
   escape), adopting the WAI-ARIA APG Enter/F2/Esc vocabulary. Composes `input` (editor), `validation`
   (commit gate), `focus-delegation` (cell focus survives the swap), optionally `rich-text`.
2. A **demo** exercising the behavior in a real browser (the standard intent+block split that
   `data-transfer`/`reorder`/`selection` each ship).
3. **Wire `data-grid` editable cells** to compose the intent (the first consumer per #1397 — no
   grid-contract change).

Gate in frontierui (`npm run check:standards` in ../frontierui). The intent's `commitOn` (fires the
write-back) stays distinct from `validation.execution`/`commitment` (gates it) — the behavior block must
respect that boundary.
