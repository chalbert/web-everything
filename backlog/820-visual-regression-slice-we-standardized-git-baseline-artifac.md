---
kind: story
size: 8
parent: "800"
status: parked
dateOpened: "2026-06-17"
tags: []
---

# Visual-regression slice: WE-standardized git baseline artifact + plateau-app review tool

Deferred visual-regression slice of the unified rendered-site harness (#800), shaped by the #799 ruling. End-state: the artifact — baselines, diffs, approval metadata — lives in a WE-standardized filesystem/git structure (standard layer, escapable, no lock-in); plateau-app provides the served diff + review UI that works with that structure (open-core) but never owns the artifact. Rejects third-party SaaS and any plateau-proprietary store. Parked until the owned review surface is warranted — a11y (#770) and content (#796) gates need none of it. Interim bootstrap if needed: committed Playwright `toHaveScreenshot` baselines. Build the WE artifact-format spec first, then the plateau tool consuming it.
