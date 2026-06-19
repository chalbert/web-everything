---
type: idea
workItem: story
size: 3
parent: "1073"
status: open
dateOpened: "2026-06-19"
tags: []
---

# Tier-2 rich-output contract + provider-seam extension

The foundation slice (A) of #1073: a normalized rich-output envelope (description / tags / element-regions) on the existing registerVisionProvider seam (we:scripts/design-refs/vision.mjs), mirroring how that file normalizes the verdict + codification halves — a new method + normalizer + the manual null-provider path, fixture-tested without a model or browser. No-leakage holds (only outputs cross). Independent, startable now; demoable as green unit tests. Unblocks slice C (#1073 in-browser provider).
