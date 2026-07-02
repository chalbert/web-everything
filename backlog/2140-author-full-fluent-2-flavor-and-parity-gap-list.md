---
kind: story
size: 5
parent: "2025"
status: open
dateOpened: "2026-07-02"
tags: [parity, flavor, fluent, dtcg]
---

# Author full Fluent 2 flavor and parity gap list

Author we:design-systems/fluent.designsystem.json + we:design-systems/fluent.tokens.json + we:design-systems/fluent.reference.json (full Fluent 2 DTCG override: #0f6cbd accent family, 4px radius scale, solid surfaces, Segoe type/depth) + we:src/_data/designSystems/fluent.json; load via the #2017 manifest loader with an FUI unit test, score via npm run parity:score (#2024), publish the gap-list report, and supersede the fluent-like stub in fui:workbench/designSystems.ts.
