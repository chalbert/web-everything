---
kind: epic
status: open
dateOpened: "2026-06-19"
relatedReport: reports/2026-06-19-backlog-split-analysis.md
tags: []
---

# On-device small-VLM vision tier (Tier 2) — richer critique, tagging, element detection

The richer on-device vision tier from the #488 ruling ('Tier-2 VLM tracked behind a benchmark, not rejected') — a small VLM (SmolVLM/Moondream/Florence-2 class, ≲2B) for design critique, tagging, and element/region detection that Tier 1's closed-set classifier (#490) cannot do. Device-gated (WebGPU ~2 GB+), so it ships as an opt-in download inside the dev browser (#141), never a mobile/default. Registers behind the same registerVisionProvider seam; no-leakage + linear-cost hold. Epic to be SLICED into batchable build pieces (model pick/eval → provider → benchmark → dev-browser surface). See we:docs/agent/vision-tiers.md.
