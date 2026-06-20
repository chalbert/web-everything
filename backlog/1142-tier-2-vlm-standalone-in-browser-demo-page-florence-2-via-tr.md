---
kind: story
size: 2
parent: "1073"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: demos/tier2-vlm-demo.html
tags: []
---

# Tier-2 VLM standalone in-browser demo page (Florence-2 via transformers-vlm)

Standalone WebGPU demo page running the #1082 transformers-vlm provider (Florence-2) on a chosen screenshot, rendering the #1080 rich envelope (description/tags/regions overlay). Needs @huggingface/transformers installed + WebGPU + opt-in ~2GB model download — unrunnable in CI/batch, so split from #1082's verified provider core. Provider self-registers via registerVisionProvider('transformers-vlm'); the page imports we:scripts/design-refs/providers/transformers-vlm.mjs and calls analyzeRich({pngBase64,dims}).
