---
type: idea
workItem: story
size: 8
status: open
blockedBy: ["838"]
dateOpened: "2026-06-17"
tags: []
---

# CEM conformance gate: run the analyzer over FUI source and fail on drift against WE's declared CEM

The home for the #801-rejected analyzer-as-source engine, recast as verifier (the #463 deterministic-conformance posture): FUI runs @custom-elements-manifest/analyzer over block source and the derived CEM is compared to WE's authored/declared CEM, failing the gate on drift. Also where the deferred programmatic/private JS surface (excluded from WE's authored contract per Fork-1=B) can be impl-scanned if a programmatic-API table is ever wanted. Separately-prioritized; blocked by #838 (needs the authored CEM to compare against).
