---
type: issue
workItem: story
size: 3
parent: "507"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
tags: []
---

# Generation-adapter core — deterministic IR→emit engine + core/shell split

Slice 1 of #507 (epic). Build the deterministic generation-adapter core: an engine that reads we:servePathIR.ts and emits a MaaS origin deterministically (same source → byte-identical, NO AI in the path), codifying the deterministic-core / HTTP-shell architectural split and a language-backend interface. Proof backend = regenerate the existing JS reference origin (we:fetchHandler.ts) byte-for-byte against a checked-in golden, validating the interface against an already-conformance-covered target before any foreign language. Home: new blocks/renderers/module-service/generation/. Per #463 fork a.
