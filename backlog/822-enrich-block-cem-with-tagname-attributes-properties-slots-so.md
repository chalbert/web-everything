---
type: decision
workItem: story
size: 3
status: active
parent: "746"
relatedProject: webdocs
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
crossRef: { url: /backlog/821-consume-mode-per-framework-wrapper-generator-block-cem-react/, label: "Wrapper generator (#821)" }
tags: [webdocs, cem, blocks, adapters, api-viewer]
---

# Enrich block CEM with tagName + attributes/properties/slots so wrappers/api-viewer get a real custom-element surface

The wrapper generator (#821) and every structural CEM consumer (api-viewer, Storybook, polyglot panel #753) need custom-element declarations, but src/_data/blocks.json carries no tagName/attributes/properties/slots — so gen-cem.mjs emits 0 custom-element declarations (class+events only) and the generator has no real block to wrap. Enrich blocks.json (or derive) with a tagName + attribute/property/slot surface so gen:cem projects real custom-element declarations. Unblocks real-block wrapping for #753.

**Retyped `decision` 2026-06-16 (batch pre-flight).** The body carries a genuine constellation-boundary fork, not a mechanical build — it can't be batched until ratified.

## Fork 1 — where does the custom-element surface (tagName + attributes/properties/slots) live?
- **A — WE `src/_data/blocks.json` holds the surface.** gen-cem reads it directly; WE owns the projected CEM. Con: WE now carries a custom-element shape (tagName/attributes) that is an *implementation* fact of the FUI block — pushes impl detail up into the standard layer (tension with the WE-never-imports-FUI / no-leakage boundary — the npm-scope-mirrors-layer rule, #239).
- **B — surface is sourced from FUI** (FUI's `blocks.json`/manifest or a CEM analyzer over FUI's tree), WE consumes the *output* only. Con: cross-repo sourcing seam; gen-cem in WE must ingest a FUI artifact.
- *Fork-existence:* both are coherent end-states (the surface genuinely could be authored in WE or derived from FUI); they can't coexist because the SoT for the tag/attribute shape must be single. Recommend **B** on the no-leakage rule — a tagName + attribute surface is an impl fact of the FUI custom element, so FUI is its SoT and WE ingests the projection (mirrors the #783 Check-2 "FUI owns its own registration convention" precedent). ~70%; residual is whether a thin WE-authored `tagName` (just the convention `fui-<id>`, no attribute detail) is cheap enough to keep WE self-contained for the api-viewer.

## Fork 2 — tag naming convention
- gen-cem never fabricates a tag (`registryName` is a DI class, not a tag). Decide the convention: `fui-<id>` vs deriving from `registryName` vs an authored `tagName` per entry. Subordinate to Fork 1 (if B, FUI's `customElements.define()` name *is* the tag — no convention to invent).
