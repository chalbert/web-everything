---
type: idea
workItem: story
size: 3
parent: "1073"
status: open
blockedBy: ["1080", "1081"]
dateOpened: "2026-06-19"
tags: []
---

# In-browser Transformers JS + WebGPU Tier-2 provider

Slice C of #1073: wrap slice B's (#1081) chosen small VLM behind slice A's (#1080) rich-output contract, running in-browser via ONNX Runtime Web / Transformers JS + WebGPU — the Tier-2 analogue of the Tier-1 provider #514. Self-registers behind registerVisionProvider; device-gated (WebGPU ~2 GB+), opt-in download, never default/mobile. Demoable as a standalone demo page running the VLM on a screenshot. Blocked by #1080 (contract) + #1081 (model). Feeds slice D.
