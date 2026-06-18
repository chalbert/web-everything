---
type: idea
workItem: task
parent: "315"
status: resolved
blockedBy: ["359"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: src/_data/blocks.json
tags: []
---

# time-picker / datetime-picker / date-range-picker named preset blocks

Slice B of the picker work (/split 359, 2026-06-15). Add the remaining named shallow preset blocks over the abstract `temporal` core (#359 slice A): `time-picker` (input[type=time], presentation media|linear), `datetime-picker` (input[type=datetime-local]), `date-range-picker` (granularity range). Each pins dims + binds its native anchor; design decision = thin preset over the temporal core, not a re-impl. fui:blocks.json entries only (sibling gap-fix pattern). Gives catalog parity with #468 inventory + design-system DatePicker/TimePicker. See we:reports/2026-06-15-backlog-split-analysis.md.

## Progress (2026-06-15, batch-2026-06-15)

Slice B delivered — three named shallow presets over the `temporal` core (#359 slice A), each a
`fui:blocks.json` entry + a description partial, no impl dir (the gap-fix pattern):

- **`time-picker`** — pins `presentation=media` (clock) + `granularity=point` over `input[type=time]`
  ([fui:blocks.json](../src/_data/blocks.json) + [we:time-picker.njk](../src/_includes/block-descriptions/time-picker.njk)).
  The scroll-wheel `linear` variant is noted as the future `presentation=linear` member over the same anchor.
- **`datetime-picker`** — pins `media` + `point` over `input[type=datetime-local]`, composing the core's
  calendar + clock surfaces ([we:datetime-picker.njk](../src/_includes/block-descriptions/datetime-picker.njk)).
- **`date-range-picker`** — pins `media` + `granularity=range` over two `input[type=date]` anchors; the
  start ≤ end ordering is the core's range coordination (the direct analogue of the slider's ordered dual
  thumbs) ([we:date-range-picker.njk](../src/_includes/block-descriptions/date-range-picker.njk)).

Each `designDecision` cites #713 option C (a preset is a dimension pin, not new machinery) + the slider
precedent (native anchor is the baseline; the distinct native anchor per member is why they are named
presets). `gen:inventory` re-run (we:AGENTS.md); `check:standards` 0 errors (each block has its partial);
`npx @11ty/eleventy --dryrun` builds clean. **Catalog parity with the #468 inventory reached** (date /
time / datetime / range pickers all present). Slice C ([#736](/backlog/736-temporal-block-impl-variant-traits-build-chunk-assertion-re-/))
— the temporal impl + traits + build-chunk assertion — remains blocked on A+B; this resolution frees it.
