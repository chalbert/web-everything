---
kind: story
size: 3
parent: "2015"
status: open
locus: frontierui
blockedBy: ["1974"]
dateOpened: "2026-07-02"
tags: []
---

# FUI: temporal presets to persistent wrapper (traits forward to the inner native input)

Migrate the three temporal presets (fui:blocks/temporal/TemporalTransientElement.ts:40-52 — DatePicker/TimePicker/DatetimePicker) off transient self-erasure: the host persists wrapping the real <input type=date|time|datetime-local>; author/config attributes incl. the calendar-grid/clock/range-coordination trait attributes forward to the inner native input so the traits keep activating on a real native control (observable surface unchanged — impl-detail forwarding, not a fork). Update temporal unit tests. Locus: frontierui.
