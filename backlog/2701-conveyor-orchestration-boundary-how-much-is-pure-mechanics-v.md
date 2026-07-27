---
bornAs: xyr248a
kind: decision
parent: "2677"
status: open
dateOpened: "2026-07-27"
tags: []
---

# Conveyor orchestration boundary: how much is pure mechanics vs a per-lane agent

The central fork #2677 defers: where does the line fall between the deterministic mechanical core (dispatch/watch/release/tick/guards — reproducible, testable, product-ready with no session) and a per-lane orchestrator agent's autonomy. De-buried from #2677's body. Must resolve before the per-lane orchestrator slice so its brief is written against a settled boundary.
