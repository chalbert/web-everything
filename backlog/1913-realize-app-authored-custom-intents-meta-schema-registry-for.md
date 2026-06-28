---
kind: decision
status: open
dateOpened: "2026-06-28"
tags: []
---

# Realize app-authored custom intents — meta-schema + registry for product-minted intents

Intent-UX-Only (we:docs/agent/platform-decisions.md:378) ratifies that intents are an open, never-finished
system — "custom non-standard intents must coexist conflict-free; standardize the meta-schema, not the list."
That promise is UNREALIZED: WE ships a fixed catalog with no seam for a product to mint and use its OWN intent.
Surfaced by #1884 (the single intent model owns all UI/UX config only if apps can extend it). DECIDE the shape:
how a product declares a custom intent (meta-schema), registers it conflict-free, build-time vs runtime
resolution against the trait resolver (we:webtraits/intentProfileResolver.ts), and namespacing against
WE-standard intents. Principle settled; the registry/authoring shape is the open call.
