---
kind: story
size: 3
parent: "315"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: src/_data/blocks.json
tags: []
---

# Activate intent:temporal + abstract `temporal` core block + `date-picker` preset

Slice A of the date/time/range picker work (re-scoped in place by `/split 359`, 2026-06-15, after its scope blocker [#713](/backlog/713-date-time-picker-scope-single-value-pickers-as-359-variants-/) ratified). Activate the **Temporal Intent** (`status: concept → active`, we:src/_data/intents.json:1389-1411 — `presentation: media|linear|input` × `granularity: point|range|multi` already modeled) and author the **abstract `temporal` core block** that realizes it — `implementsIntent: temporal`, `composesIntents: [temporal, locale, input, focus-delegation]`, native-input anchoring (`input[type=date|time|datetime-local]`), locale-aware formatting — plus the first named shallow preset **`date-picker`** (pins `presentation: media`/`granularity: point` over `input[type=date]`). Standards-layer deliverable, matching the sibling gap-fix pattern (drawer/dialog/notification/carousel graduated as `fui:blocks.json` entries, no impl dir).

## Decided shape — #713 option C (ratified 2026-06-15)

One abstract `temporal` core block holding the shared machinery contract **plus** named shallow preset blocks (`date-picker`, `time-picker`, `datetime-picker`, `date-range-picker`) that pin `granularity`/`presentation` and bind their native anchor — presets over one core, not re-implementations. The three distinct native anchors (`input[type=date|time|datetime-local]`) are the concrete platform reason for named presets that the single-anchor slider precedent (fui:src/_data/blocks.json:3175-3192) lacked. Design decisions on the core should cite #713 C + the slider precedent.

## Slices off this (the `/split 359` shape)

- **A (this card)** — activate `intent:temporal` + abstract `temporal` core + `date-picker` preset.
- **B** (task, blocked on A) — `time-picker` / `datetime-picker` / `date-range-picker` named presets.
- **C** (story, blocked on A+B, re-slice) — temporal block impl: `calendar-grid`/`clock`/`range-coordination` traits in `traitMap` + the build-chunk assertion (#713: "a time-only fixture pulls no calendar chunk"). Deferred because WE has zero authored traits today (`traitEnforcer({ traitMap: {} })`, vite.config.mts:104) — the impl seams aren't investigable until A lands the first WE trait pattern.

See we:reports/2026-06-15-backlog-split-analysis.md (focused `/split 359` re-run).

## Progress (2026-06-15, batch-2026-06-15)

Slice A delivered — standards-layer, no impl dir (the gap-fix pattern: drawer/dialog/notification/slider
graduated as `fui:blocks.json` entries):

- **Activated the Temporal Intent:** [we:src/_data/intents.json](../src/_data/intents.json) `temporal`
  `status: concept → active` (the `presentation: media|linear|input` × `granularity: point|range|multi`
  dimension space was already modelled).
- **Authored the abstract `temporal` core block:** [fui:src/_data/blocks.json](../src/_data/blocks.json) +
  [we:src/_includes/block-descriptions/temporal.njk](../src/_includes/block-descriptions/temporal.njk) —
  `implementsIntent: temporal`, `composesIntents: [temporal, locale, input, focus-delegation]`, native-input
  anchoring (`input[type=date|time|datetime-local]`), locale-aware formatting. It pins no dimension (it is
  the contract). `designDecisions` cite **#713 option C** (one core + named shallow presets) and the
  **slider precedent** (native baseline, enhance the gap; three native anchors are the concrete reason for
  named presets the single-anchor slider lacked), per the card.
- **Authored the first preset, `date-picker`:** fui:blocks.json entry +
  [we:date-picker.njk](../src/_includes/block-descriptions/date-picker.njk) — `intentDimensions: {presentation:
  media, granularity: point}` over `input[type=date]`; no machinery of its own (all inherited from the core).
- **Inventory + gates:** `gen:inventory` re-run (we:AGENTS.md); `check:standards` 0 errors (each block now has
  its description partial); `npx @11ty/eleventy --dryrun` builds clean (both `/blocks/temporal/` +
  `/blocks/date-picker/` render).

Cascades: **slice B ([#735](/backlog/735-time-picker-datetime-picker-date-range-picker-named-preset-b/))**
— the remaining named presets — is `blockedBy #359` and is freed by this resolution; **slice C
([#736](/backlog/736-temporal-block-impl-variant-traits-build-chunk-assertion-re-/))** — the impl + traits
+ build-chunk assertion — remains blocked on A+B (and is the first WE `traitMap` consumer, now unblockable
on the A pattern).
