---
kind: task
parent: "1442"
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1442
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, transient-element, temporal, frontierui]
---

# Convert temporal to we-temporal custom element (transient/A)

Package the temporal block as a transient custom element per the #1675 ruling (mechanism A, codified §7). Each preset registers a tag (we-date-picker / we-time-picker / we-datetime-picker, or we-temporal) that self-replaces with the single native input it pins (<input type="date|time|datetime-local">) via the TransientElement pattern; the CalendarGrid/Clock/RangeCoordination CustomAttribute behaviors keep riding the surviving native input unchanged. Native form participation, validity, locale value, and the zero-JS fallback are kept free. No persistent wrapper or imperative property surface (B is excluded). Mirror the badge/button/card convert tasks.

## Progress (batch-2026-06-23-1725-1665) — DONE

Packaged the temporal block as transient custom elements (Mechanism A, #1675 §7), mirroring the badge/button/card converts:
- `fui:blocks/temporal/TemporalTransientElement.ts` — a `TemporalTransientElement` base (`resolveTag` → `input`, `decorate` pins the `type`) + three presets: `DatePickerElement` (`<we-date-picker>` → `<input type="date">`), `TimePickerElement` (`type="time"`), `DatetimePickerElement` (`type="datetime-local"`). Each upgrades and self-replaces with the single native input it pins, erasing the wrapper.
- `fui:blocks/temporal/registerTemporal.ts` — `registerTemporal()` (idempotent per tag; `TEMPORAL_TAGS` defaults `we-date-picker`/`we-time-picker`/`we-datetime-picker`, consumer-overridable, #841/#1381) + `fui:blocks/temporal/index.ts` barrel (elements + register + the existing `datetimeCompose`).
- `fui:blocks/__tests__/unit/temporal/TemporalTransientElement.test.ts` — 5 tests green.

The `TransientElement` base transfers all author attributes (`value`/`min`/`max`/`step`/`required`/`name` + the `calendar-grid`/`clock`/`range-coordination` trait attributes) onto the surviving native input, so the CalendarGrid/Clock/RangeCoordination `CustomAttribute` behaviors keep riding it unchanged. `decorate` pins the preset `type` after transfer, so it always wins over a stray author `type`. Native form participation / validity / locale value / zero-JS fallback come free; no persistent wrapper, no imperative property surface (Mechanism B excluded). FUI gate 0 errors.
