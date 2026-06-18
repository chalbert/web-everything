---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["729"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# Build: CapacityProvider contract + device-capacity vocabulary (scalar+bucket output)

Implements the ratified #729 Fork 1+2: a CapacityProvider contract sibling to CapabilityProvider (we:capabilities/provider.ts), keyed by capacity dimension, registered through the same #206 adapter table and resolved via the same Venue dimension + PlatformSupport degrade contract. Each read answers BOTH a raw scalar (deviceMemory:8, cores:8) and a derived coarse bucket (high/mid/low or GPU tier). Adds the adaptive-loading vocabulary rows (hardwareConcurrency, deviceMemory, effectiveType/saveData, GPU tier) borrowing official platform names. Native reads (CPU/RAM/network) ship as the default impl; GPU-tier and the composite router are separate spin-offs. Foundation of the #729 build chain.
