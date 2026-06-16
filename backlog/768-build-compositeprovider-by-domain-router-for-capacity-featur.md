---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["767"]
dateOpened: "2026-06-16"
tags: []
---

# Build: CompositeProvider by-domain router for capacity/feature/network sources

Implements the ratified #729 Fork 3-A: a CompositeProvider holding a { domain -> provider } map that dispatches each query to its configured source (feature -> CapabilityProvider, capacity -> CapacityProvider, network -> edge), satisfying the same interface so the native-first resolver (capabilities/resolver.ts) and venue selection run unchanged. Routes by coarse domain (the enumerable registration unit), not per-id. By-domain is non-restrictive: registering the same provider for every domain collapses to single-provider behaviour, so it adds a capability without an obligation. The B fallback-chain shape is a later additive nest inside a slot, not part of this build. Blocked by #767 (needs the sibling CapacityProvider to route to).
