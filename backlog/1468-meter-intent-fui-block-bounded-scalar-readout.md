---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/meter.json"
tags: []
---

# meter intent + FUI block — bounded-scalar readout

Realizing build for the #1410 ratification (Fork 1a): author the WE `meter` intent JSON adopting native `<meter>`/`role=meter` vocabulary verbatim (value/min/max/low/high/optimum, valuetext), plus a `presentation` dimension (bar | radial gauge) and a `zones` dimension (none | low-high-optimum). FUI owns the rendered block; ship a demo (disk usage / password strength / radial gauge). Gauge is a radial presentation, not a separate intent. Codified rule: [readout-placement-by-value-type](../docs/agent/platform-decisions.md#readout-placement-by-value-type).

## Progress (batch-2026-06-21)

- **WE intent** `we:src/_data/intents/meter.json` (status active) — adopts native `<meter>`/`role=meter`
  vocabulary verbatim (value/min/max/low/high/optimum + valuetext), dimensions `presentation` (bar|radial)
  + `zones` (none|low-high-optimum); description grounds it against progress/status-indicator (three
  value-types, three homes) and notes gauge = a radial presentation, not a separate intent.
- **FUI block** `fui:blocks/meter/Meter.ts` (+ `fui:blocks/meter/index.ts`): `createMeter` renders `bar` as
  a native `<meter>` (value/min/max/low/high/optimum + aria-valuetext/labelledby) and `radial` as an SVG
  gauge with `role=meter` + the aria value attributes (same contract, arc presentation); `meterZone`
  mirrors the native low/high/optimum three-zone model; `zones: low-high-optimum` emits `data-zone` →
  theme-coloured (`--tone-*`). Registered in `fui:src/_data/blocks.json` (completeness gate #784).
- **Demo** `fui:demos/meter-demo.html` — disk usage (zoned bar) · password strength (zoned bar) · capacity
  (radial gauge). Verified live on :3001: 2 native meters + 1 radial gauge + 3 zoned roots render.
- 5 unit tests `fui:blocks/__tests__/unit/meter/Meter.test.ts` (bar native contract, aria, radial role=meter,
  zone classification, data-zone gating). WE intent page 200 on :8080; WE + FUI `check:standards` → 0 errors.
