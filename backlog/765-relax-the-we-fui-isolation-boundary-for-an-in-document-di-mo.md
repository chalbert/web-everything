---
type: decision
workItem: story
size: 3
parent: "728"
status: open
blockedBy: ["728"]
dateOpened: "2026-06-16"
tags: []
---

# Relax the WE-FUI isolation boundary for an in-document (DI mount) FUI embed in WE docs

The constellation forbids WE rendering FUI block code in its own document; the sandboxed iframe enforces it. #732 surfaced that this wall exists for *cross-organization* trust — yet WE↔FUI is one constellation, complete trust. So a fourth render mode is reachable for WE's own docs: the FUI embed SDK mounts the component directly in WE's host DOM (Shadow-DOM / DI), where overlays escape natively, zero coordination — a runtime bundle, not the #700-ruled-out source import. Decide whether to relax the isolation boundary for the trusted pair. Not an escape need (#732's A/B1/B2 cover that) — a fidelity option costing isolation.
