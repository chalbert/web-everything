---
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-25"
tags: []
---

# Declare an operation that dispatches an independent review to a fresh session

review-pr cannot be invoked by the PR's author: the self-clear guard refuses the authoring session, and a subagent inherits its id. So something must spawn a NON-author session, and nothing declares it. Measured 2026-08-25: ten review mandates hand-written in one session, the largest single source of repeated orchestration that day — the same evidence and the same shape that got #3160 filed for prepare. A caller restricted to declared operations cannot get its own work reviewed at all.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
