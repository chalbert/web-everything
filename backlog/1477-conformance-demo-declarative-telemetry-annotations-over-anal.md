---
kind: task
status: open
blockedBy: ["1475"]
dateOpened: "2026-06-21"
tags: []
---

# Conformance demo — declarative telemetry annotations over analytics-conformance-demo

Per #1415, extend the existing analytics conformance demo (we:src/_data/demos/analytics-conformance-demo.json, #1014) with declarative data-track annotations exercising the new emission seam (#1475) end-to-end: element annotation -> CustomTrackerRegistry resolution -> track() against a swappable sink, with the NoopTracker floor when unconfigured.
