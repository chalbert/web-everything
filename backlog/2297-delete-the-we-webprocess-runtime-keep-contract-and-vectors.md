---
kind: task
parent: "1294"
status: open
blockedBy: ["2296"]
dateOpened: "2026-07-06"
tags: []
---

# Delete the WE webprocess runtime, keep contract and vectors

Delete we:process/driver.ts, we:process/provider.ts, we:process/registry.ts, we:process/index.ts and the runtime test, retaining we:process/contract.ts, we:contracts/webprocess.ts, and we:conformance-vectors/webprocess.vectors.ts — reaching the #1282 zero-impl end-state. Final slice of the process cascade under #1294.
