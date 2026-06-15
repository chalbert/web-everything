---
type: idea
workItem: story
size: 13
parent: "315"
blockedBy: ["713"]
status: open
dateOpened: "2026-06-12"
tags: []
---

# Date / time / range picker block

Date / time / range picker block — calendar-based date, time, and date-range selection with locale-aware formatting. Gap from the competitive coverage analysis (#347): intent:temporal defines the UX axis but no block implements a picker; native input[type=date|time] is the anchor for the simple case, intent:locale for formatting. High effort (calendar grid, keyboard, range, i18n). Candidate from the gap sweep — groom/split before building.

> **Sized 8 → 13 (2026-06-15, batch pre-flight):** not a single batchable slice — needs grooming/`/split` first AND carries an unresolved scope call. Dropped from the batch pool until split.

**Blocked on the scope-call decision [#713](/backlog/713-date-time-picker-scope-single-value-pickers-as-359-variants-/).** `/split 359` (2026-06-15) found this is *could-not-split*: the open call — **are single-value date/time pickers variants of this block, or their own blocks?** (delegated here from the resolved form-control inventory [#468](/backlog/468-form-control-block-inventory-datepicker-timepicker-input-fam/)) — determines the entire slice shape, and you can't split away a fork. The fork is now tracked as decision #713 (default: one temporal block, variants by `granularity`/`presentation` — the slider precedent). Once #713 ratifies, re-run `/split 359` against the decided shape (likely: activate `intent:temporal` + a first native-anchored block as foundational slice A, then the variants/range slices off it). See reports/2026-06-15-backlog-split-analysis.md.
