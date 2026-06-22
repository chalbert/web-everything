---
kind: story
size: 3
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-22"
graduatedTo: "we:src/_data/intents/progress.json"
tags: []
---

# progress intent + FUI block — determinate task/completion readout (role=progressbar)

Realizing build for the #1469 ratification (Fork 2b): author the WE `progress` intent JSON adopting native `<progress>`/`role=progressbar` vocabulary verbatim (value, max; omit value → indeterminate, drops aria-valuenow; no min/zones — that is meter). Models a determinate task/completion readout decoupled from a pending/blocking lifecycle (profile % complete, course progress, fundraising goal). loader.progress and flow-progress compose it as consumers, not its home. FUI owns the rendered block; ship a demo. Codified rule: readout-placement-by-value-type. Low priority — common case is already covered by loader.progress.

## Progress (batch-2026-06-21-1429-1487)

Realized both halves (mirroring the sibling meter intent/block #1468):
- **WE — `we:src/_data/intents/progress.json`** (new) — `status: active`. Adopts `<progress>`/
  `role=progressbar` verbatim (value/max, default max 1); omit `value` → indeterminate (drops
  `aria-valuenow`); **no min, no zones** (that is meter). One dimension `presentation` (`bar` default |
  `circular`). `valuechange` event. Description draws the ARIA progress-vs-meter-vs-status lines and the
  loader-composes-it-not-its-home decoupling, cites `#readout-placement-by-value-type`.
  + **`we:src/_data/semantics/progress.json`** (glossary term).
- **FUI — `fui:blocks/progress/Progress.ts`** (new) + **`fui:blocks/progress/index.ts`** —
  `createProgress`/`mountProgress` config factory + Mode-C `mountInDocument`. `bar` renders the native
  `<progress>` (indeterminate when `value` omitted — no value attr, no aria-valuenow); `circular` renders
  an SVG ring with `role=progressbar` + aria values (indeterminate ring = spinner, drops aria-valuenow).
  Fill colour from theme tokens (`--color-primary`), never an author hex.
  + **`fui:blocks/__tests__/unit/progress/Progress.test.ts`** (5 vectors: bar contract, indeterminate
  bar, aria-valuetext/labelledby, circular role=progressbar, indeterminate ring) — all green.
  + **`fui:demos/progress-demo.html`** (new) + a **`fui:src/_data/blocks.json`** entry (registered as a
  Module block, weSpecPath `/intents/progress/`, demoFile `fui:demos/progress-demo.html`).

Both gates green (0 errors), no tsc errors. WE owns the intent contract; FUI owns the rendered block
(constellation-placement). `loader.progress` / flow-progress compose this as consumers.
