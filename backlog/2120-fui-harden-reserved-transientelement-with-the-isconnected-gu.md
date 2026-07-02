---
kind: task
parent: "2015"
status: resolved
locus: frontierui
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# FUI: harden reserved TransientElement with the isConnected guard

Add the missing if (!this.isConnected) return; inside the deferred replace at fui:blocks/transient/TransientElement.ts:75 (the #1961 rider's third leg — idempotence + microtask deferral already present) plus a disconnect-before-microtask unit test beside fui:blocks/__tests__/unit/transient/TransientElement.test.ts. The mechanism stays: TransientElement is retained for the reserved content-model-child case (#1962). Locus: frontierui.
