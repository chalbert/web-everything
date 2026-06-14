---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["575"]
dateOpened: "2026-06-14"
tags: []
---

# Conformance-evidence manifest — standard-owned contract for bot-PR evidence (app-emits)

Mint the standard-owned conformance-evidence manifest ruled by #578 (Fork 2-A): a WE-standard contract emitted by the app's introspectable self-description / trace substrate (reusing the capabilityMatrix vocabulary), carrying which-gates-ran + the verify before/after + the autonomy level. Same app-emits / tool-consumes shape as #575's source-anchor contract; classified a self-description extension CONTRACT, not a Protocol (no swappable-vendor interop — minimize lock-in). Built as a SIBLING extension reusing #410-4A's audit-record substrate (separation bias), not a field-set on it. Runtime-agnostic → a polyglot .NET/Java fix-loop emits the same manifest (forward-adapter reach). Gated on #575's self-description substrate.
