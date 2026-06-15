---
type: decision
workItem: story
size: 2
status: active
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
tags: []
---

# Date/time picker scope — single-value pickers as #359 variants vs. their own blocks

Open scope fork delegated from [#468](/backlog/468-form-control-block-inventory-datepicker-timepicker-input-fam/) (resolved 2026-06-13, which handed the datepicker/timepicker scope to #359 "to settle in #359's own split"). [#359](/backlog/359-date-time-range-picker-block/) is blocked on this call — its slice shape can't be drawn until the fork is ruled, so it surfaced as *could-not-split* in the 2026-06-15 split analysis (reports/2026-06-15-backlog-split-analysis.md).

## The fork

**Are single-value date and time pickers variants of the #359 picker block, or their own blocks?** The answer determines #359's entire decomposition: under A the slices are `task`s configuring one block; under B they are separate `story`s (a datepicker block + a timepicker block + a range block), each with its own registry entry, demo, and fixtures.

### A — one temporal block, variants by dimension *(default)*

A date picker is `point`+`media` (calendar grid), a time picker is `point`+`linear`/`media` (clock), range is `granularity: range` — `intent:temporal` already models all three as **one protocol** (`presentation: media|linear|input` × `granularity: point|range|multi`, src/_data/intents.json:1389-1411). One block consuming temporal, configured by `granularity`/`presentation` over the native `input[type=date|time|datetime-local]` anchor, mirrors the **slider precedent**: single + dual-thumb is one block over `input[type=range]`, not two (src/_data/blocks.json:3175-3192). Native-first, one machinery (calendar grid / keyboard / i18n) shared across variants.

### B — separate datepicker / timepicker blocks

Distinct registry entries, matching #468's original inventory listing and several design-system catalogs (which ship `DatePicker` and `TimePicker` as separate components). Cost: duplicates the calendar-grid / keyboard / i18n machinery across blocks and diverges from `intent:temporal`'s single-protocol model.

## Why default A

The temporal intent was authored as a single protocol spanning all granularities, and the slider block already set the constellation precedent that native-input-anchored selection variants live in **one** block, not split per variant. B would fragment shared machinery and contradict the intent's own shape. Pick B only if a concrete authoring or platform reason makes a standalone datepicker/timepicker genuinely a different block, not a configured variant.

*Not ratified — this card files the fork for a `/prepare` → `/decision` pass; #359 re-`/split`s against the decided shape.*
