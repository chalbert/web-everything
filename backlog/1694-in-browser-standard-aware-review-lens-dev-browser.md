---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
blockedBy: ["1693"]
dateOpened: "2026-06-23"
tags: []
---

> **Pre-flight (batch-2026-06-26-1732-1696):** Slice B over Slice A's declared-rule reader (#1693) — re-pointed `blockedBy: ["1693"]`. #1693 is itself deferred (no app declares rules; the gate has no consumer yet), so this live lens has nothing to surface until that lands. It is also a **live dev-browser surface** whose acceptance is interactive verification in the running app (not headlessly verifiable in a serial batch). Released unbuilt.

# In-browser standard-aware review lens (dev browser)

Slice B of the standard-aware review assistant (#1640, ratified go): the live dev-browser surface that flags declared-conformance drift pre-human as you view a change. Same declared-rule reader as the PR gate (Slice A) and #1689; surfaced in the running app. Home plateau:dev-browser.
