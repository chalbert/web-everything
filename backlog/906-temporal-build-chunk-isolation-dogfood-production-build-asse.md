---
type: idea
workItem: story
size: 5
parent: "315"
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# Temporal build-chunk isolation dogfood — production-build assertion that per-preset fixtures pull only their traits' chunks

Carved from #898 (batch-2026-06-17): the datetime-picker PRESET shipped (calendar-grid + clock composition, frontierui/demos/datetime-picker), but the #713 build-chunk dogfood — a PRODUCTION-build assertion that a date-only fixture pulls no clock chunk and a time-only fixture pulls no calendar chunk (per-preset trait isolation) — outgrew the preset slice: FUI has no production-build chunk-isolation test harness (the enforcer test only covers manifest generation, not a real vite build), and this overlaps the generic cross-bundler chunk-isolation conformance owned by #720/#722. Build a harness that runs vite build (frontierui locus) on minimal date-only / time-only / datetime fixtures and inspects the rollup output chunk graph to assert each fixture loads only its bound traits' chunks. Coordinate scope with #720/#722 (generic) — this is the temporal per-preset dogfood. locus frontierui.
