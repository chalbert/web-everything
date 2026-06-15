---
type: idea
workItem: story
size: 13
parent: "315"
status: open
dateOpened: "2026-06-12"
tags: []
---

# Date / time / range picker block

Date / time / range picker block — calendar-based date, time, and date-range selection with locale-aware formatting. Gap from the competitive coverage analysis (#347): intent:temporal defines the UX axis but no block implements a picker; native input[type=date|time] is the anchor for the simple case, intent:locale for formatting. High effort (calendar grid, keyboard, range, i18n). Candidate from the gap sweep — groom/split before building.

> **Sized 8 → 13 (2026-06-15, batch pre-flight):** not a single batchable slice — needs grooming/`/split` first AND carries an unresolved scope call (single-value date/time pickers as variants here vs. their own blocks). Dropped from the batch pool until split.

**Owns the datepicker/timepicker scope call (from #468, resolved 2026-06-13):** the form-control inventory epic #468 listed standalone *datepicker* and *timepicker* blocks, which this block already covers (date + time + range). #468 resolved once its build slices landed and delegated this scope here. When grooming/splitting this item, reconcile whether single-value date/time pickers are variants here or their own blocks — that call now lives in this item's own split.
