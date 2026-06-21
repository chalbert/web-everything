---
kind: story
size: 5
parent: "099"
status: resolved
locus: frontierui
blockedBy: []
relatedProject: webintents
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:blocks/edit-in-place/editInPlace.ts"
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

## Progress (batch-2026-06-21)

1. **FUI behavior block** `fui:blocks/edit-in-place/editInPlace.ts` (+ `fui:blocks/edit-in-place/index.ts`):
   `createEditInPlace(host, options)` swaps a value's display renderer ⇄ editor on activation
   (click/dblclick/affordance/programmatic), commits on blur/enter/explicit, cancels-reverts on Escape —
   adopting the WAI-ARIA APG **Enter/F2/Esc** vocabulary via the pure `editInPlaceAction` engine. The
   commit fires a **cancelable `edit-in-place-commit`** seam (detail `{value}`) BEFORE the write — a
   consumer cancels it to veto (the validation gate), keeping `commitOn` distinct from validation policy
   (the #1449 boundary). Composes input (editor) + focus survival (refocus host on leave).
2. **Demo** `fui:demos/edit-in-place-demo.html` — inline name/quantity fields + an editable table; the
   Quantity field rejects non-numbers by cancelling the commit seam. Verified live on :3001: dblclick →
   `<input>` swap, Enter commits (`committed name = Grace Hopper`), validation veto holds.
3. **Data-grid composition** (acceptance #3, no grid-contract change):
   `fui:blocks/renderers/data-grid/editableGrid.ts` now **composes** the block's vocabulary — its
   `EDIT_ENTER_KEYS`/`EDIT_COMMIT_KEYS`/`EDIT_CANCEL_KEYS` re-export the edit-in-place
   `EDIT_ACTIVATION_KEYS`/`EDIT_COMMIT_KEYS`/`EDIT_CANCEL_KEYS` (the grid is the first consumer per #1397).
   Export surface unchanged; grid edit suite 31/31 still green.
- Registered in `fui:src/_data/blocks.json` (completeness gate). 6 unit tests
  `fui:blocks/__tests__/unit/edit-in-place/editInPlace.test.ts` (mode engine, swap/commit/cancel, veto seam,
  grid-composition identity). FUI `check:standards` → 0 errors; typecheck clean.
