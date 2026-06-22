---
kind: story
size: 3
parent: "1472"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:src/_data/intents/annotation.json"
tags: []
---

# annotation intent JSON — UX-only motivation payload over the #1471 anchor contract

Author we:src/_data/intents/annotation.json (UX-only per #1408 Fork 2): select content -> attach a motivation payload (highlighting|commenting|tagging|suggestion) + overlay disposition; composes the resolved #1471 we:range-anchor/contract.ts + selection/rich-text/anchor/highlight-api intents; owns no anchor machinery. Mirrors the we:src/_data/intents/anchor.json shape; self-registers via the intents glob loader. Orphaned-annotation is a first-class outcome.
