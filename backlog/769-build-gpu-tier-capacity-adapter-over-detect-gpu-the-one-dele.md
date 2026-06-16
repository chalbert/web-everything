---
type: issue
workItem: task
status: open
blockedBy: ["767"]
dateOpened: "2026-06-16"
tags: []
---

# Build: GPU-tier capacity adapter over detect-gpu (the one delegated dependency)

Implements the GPU-tier signal for the #729 CapacityProvider by delegating to detect-gpu (pmndrs) — the single device axis the #729 survey found warranting a dependency (CPU/RAM/network are native reads; battery excluded as broken). Registers as a capacity resolver impl (impl-is-not-a-standard) answering the GPU dimension with its raw fps-derived tier (0-3) and the coarse bucket per Fork 2. Carries the dependency-addition risk in isolation so it can be prioritized separately from the native-reads contract. Blocked by #767 (implements a dimension of the CapacityProvider contract).
