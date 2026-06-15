---
type: issue
workItem: story
size: 5
parent: "715"
status: open
blockedBy: ["716"]
dateOpened: "2026-06-15"
tags: []
---

# Composed-component trait-set authoring construct + production build-chunk assertion

A first-class authoring construct where a composed component declares the trait set it binds (so a date-picker declares calendar-grid, a time-picker declares clock — never each other's), plus a PRODUCTION build-chunk assertion that an unused trait emits zero chunk. Today only the per-usage attribute scan (#034/#202) and a Vite-dev Playwright check exist; there is no component-level trait-set declaration and no production-build (not dev-server) chunk-isolation test. This is the construct option C of #713 relies on (one abstract temporal block + named shallow preset blocks, each declaring only its traits). Blocked on the #716 contract; the cross-tool form of the assertion folds into the #716-gated conformance suite.
