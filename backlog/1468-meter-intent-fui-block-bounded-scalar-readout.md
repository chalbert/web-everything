---
kind: story
size: 3
status: open
dateOpened: "2026-06-21"
tags: []
---

# meter intent + FUI block — bounded-scalar readout

Realizing build for the #1410 ratification (Fork 1a): author the WE `meter` intent JSON adopting native `<meter>`/`role=meter` vocabulary verbatim (value/min/max/low/high/optimum, valuetext), plus a `presentation` dimension (bar | radial gauge) and a `zones` dimension (none | low-high-optimum). FUI owns the rendered block; ship a demo (disk usage / password strength / radial gauge). Gauge is a radial presentation, not a separate intent. Codified rule: [readout-placement-by-value-type](../docs/agent/platform-decisions.md#readout-placement-by-value-type).
