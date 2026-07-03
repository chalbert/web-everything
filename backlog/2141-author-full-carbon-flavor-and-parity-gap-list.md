---
kind: story
size: 5
parent: "2025"
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
relatedReport: reports/2026-07-03-parity-compliance.md
tags: [parity, flavor, carbon, dtcg]
---

# Author full Carbon flavor and parity gap list

Author we:design-systems/carbon.designsystem.json + we:design-systems/carbon.tokens.json + we:design-systems/carbon.reference.json (full Carbon DTCG override: #0f62fe accent, no-radius, compact density, IBM Plex type scale) + we:src/_data/designSystems/carbon.json; load via the #2017 manifest loader with an FUI unit test, score via npm run parity:score (#2024), publish the gap-list report, and supersede the carbon-like stub in fui:workbench/designSystems.ts.
