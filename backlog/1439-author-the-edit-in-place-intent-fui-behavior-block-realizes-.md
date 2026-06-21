---
kind: story
size: 5
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/edit-in-place.json"
tags: [edit-in-place, inline-edit, editing, intent, realizing-build]
---

# Author the edit-in-place intent + FUI behavior block (realizes #1397 ruling)

Realize the #1397 ratified placement: mint the edit-in-place WE intent (dimensions draft: activation = click|dblclick|F2|programmatic, commitOn = blur|enter, cancelOn = escape reverts-to-baseline, editor pointer), composing input/validation/focus-delegation/(opt) rich-text rather than re-owning them — adopt the WAI-ARIA APG Enter/F2/Esc vocabulary. Then the FUI behavior block that realizes it + a demo, and wire data-grid editable cells to compose it (first consumer, no grid-contract change). Author one crisp sentence delimiting this intent's commitOn vs validation's execution/commitment so they don't both claim 'commit on blur'. File via /new-standard.

## Progress

- Minted the WE intent we:src/_data/intents/edit-in-place.json (+ glossary
  we:src/_data/semantics/edit-in-place.json); auto-renders at /intents/edit-in-place/ via
  we:src/intent-pages.njk. `status: concept` (FUI realization carved, below).
- Dimensions per the #1397 draft: `activation` (click/dblclick/affordance/programmatic), `commitOn`
  (blur/enter/explicit), `cancelOn` (escape — effectively fixed, baseline-revert), `editor`
  (input/rich-text/custom — a composition pointer). Owns only the thin residual; composes
  input/validation/focus-delegation/(opt) rich-text. APG Enter/F2/Esc vocabulary authored.
- Authored the one-sentence commitOn↔validation boundary: edit-in-place's `commitOn` decides WHEN the
  write-back is attempted; validation's `execution`/`commitment` decides WHETHER it's permitted.
- **Carved the FUI realization** (behavior block + demo + data-grid editable-cell wiring) into **#1449**
  (`locus: frontierui`) — a separate-locus impl deliverable that depends on this contract. #1397 bundled
  it into #1439's title; this batch delivers the WE standard half and tracks the FUI half as its own
  ready slice (mirrors every other intent mint in this batch: spec in WE, build deferred).
