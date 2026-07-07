---
kind: story
size: 3
parent: "2015"
status: resolved
locus: frontierui
blockedBy: ["1974"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
tags: []
---

# FUI: temporal presets to persistent wrapper (traits forward to the inner native input)

Migrate the three temporal presets (fui:blocks/temporal/TemporalTransientElement.ts:40-52 — DatePicker/TimePicker/DatetimePicker) off transient self-erasure: the host persists wrapping the real <input type=date|time|datetime-local>; author/config attributes incl. the calendar-grid/clock/range-coordination trait attributes forward to the inner native input so the traits keep activating on a real native control (observable surface unchanged — impl-detail forwarding, not a fork). Update temporal unit tests. Locus: frontierui.

## Resolution (2026-07-07) — frontierui PR #16

Reparented the shared temporal base onto the #2028 `fui:blocks/light-leaf/LightLeafElement.ts` **(B) wrap-a-real-native-child** shape (same migration as `we-button` #2121 / `we-filter-chip` #2122): `resolveTag()` → `childTag()` returning `'input'`; `decorate()` still only pins `type` (set after the base copies attributes down, so the preset type wins over a stray author `type`). The `calendar-grid`/`clock`/`range-coordination` trait attributes — plus `value`/`min`/`max`/`step`/`required`/`name` — forward onto the inner `<input>` via the base's non-config copy-down, so the `CustomAttribute` trait mixins keep activating on a real native control (observable surface unchanged). Renamed `TemporalTransientElement` → `TemporalHostElement` (base only; `DatePickerElement`/`TimePickerElement`/`DatetimePickerElement` names unchanged; no external consumers). Unit tests updated to the persistent-host shape (5 element tests green; the CalendarGrid/Clock/RangeCoordination trait tests are unaffected). Landed as **frontierui PR #16** (`ready-to-merge`); the WE-side status splice is this change.
