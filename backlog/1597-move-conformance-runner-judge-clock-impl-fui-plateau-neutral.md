---
kind: story
size: 5
parent: "1576"
status: open
dateOpened: "2026-06-22"
tags: []
---

# Move conformance runner/judge/clock impl FUI→Plateau (neutral conformance run)

Move the executable conformance engine — runConformanceVector + judgeConformanceTrace + ConformanceVectorOracle + the VectorSample/VectorTrace trace types (fui:tools/explorer/oracles/conformanceVectors.ts) + VirtualClock (fui:tools/explorer/oracles/virtualClock.ts) — from FUI to plateau-app (the neutral conformance runner; same home as #427/#1577); re-wire fui:tools/explorer/oracles/index.ts Layer-2 export per the #1595 interim-wiring ruling. WE holds zero executable (#1282/#1566). blockedBy #1596 (interface in WE) + #1595 (interim wiring).
