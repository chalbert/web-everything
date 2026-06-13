---
type: idea
workItem: story
size: 8
parent: "315"
status: open
dateOpened: "2026-06-12"
tags: []
---

# Date / time / range picker block

Date / time / range picker block — calendar-based date, time, and date-range selection with locale-aware formatting. Gap from the competitive coverage analysis (#347): intent:temporal defines the UX axis but no block implements a picker; native input[type=date|time] is the anchor for the simple case, intent:locale for formatting. High effort (calendar grid, keyboard, range, i18n). Candidate from the gap sweep — groom/split before building.

**Scope overlap with #468:** the form-control inventory epic #468 lists standalone *datepicker* and *timepicker* blocks, which this block already covers (date + time + range). When grooming/splitting this item, reconcile whether single-value date/time pickers are variants here or their own blocks — #468 holds them pending that call.
