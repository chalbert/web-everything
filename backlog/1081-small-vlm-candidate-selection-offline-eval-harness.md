---
type: idea
workItem: story
size: 3
parent: "1073"
status: open
dateOpened: "2026-06-19"
tags: []
---

# Small-VLM candidate selection + offline eval harness

Slice B of #1073: pick a small-VLM candidate (SmolVLM / Moondream / Florence-2 class, ≲2B) and build an OFFLINE eval that scores it on the OBJECTIVELY-measurable capabilities (tagging, element/region detection) against a held-out set. Scoped to objective capabilities on purpose so it does NOT wait on the #1034 critique rubric; the critique-quality benchmark folds in once #1034 lands. Independent, startable now; demoable as a dated eval report ranking candidates. Feeds slice C.
