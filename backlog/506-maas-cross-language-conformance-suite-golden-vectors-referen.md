---
type: issue
workItem: story
size: 8
parent: "081"
status: resolved
blockedBy: ["505"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: blocks/renderers/module-service/conformance
tags: []
---

# MaaS cross-language conformance suite — golden vectors + reference impl + runner, gating every origin target

Ratified in #463 (fork c): build the shared cross-language MaaS conformance suite that gates every origin target's release. Golden vectors = #088 content-hash fixtures (input definition → expected artifact bytes + hash + SRI + cache headers); reference impl = the #461 JS origin (`createMaaSFetchHandler`); plus a runner driving any target against the vectors. Byte-identical / identity-stable fidelity is enforced HERE — deterministically, not by AI or per-language ad-hoc tests (the protobuf/gRPC lesson: same spec, 0 vs 1,847 failures). Orthogonal to the generation mechanism — the gate is what makes any mechanism safe.
