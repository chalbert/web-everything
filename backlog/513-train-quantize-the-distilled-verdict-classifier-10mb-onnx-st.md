---
kind: story
size: 5
parent: "490"
status: parked
blockedBy: []
dateOpened: "2026-06-14"
tags: []
---

# Train + quantize the distilled verdict classifier — <=10MB ONNX student (per #488 F1/F2)

Run slice A's (#511) recipe against the accumulated design-ref corpus to produce a <=10MB-quantized MobileNet/ViT student for the 6-verdict taxonomy via task-specific knowledge distillation (VL2Lite/PAND/VLM-KD) from the big-model labels, gated by slice B's (#512) benchmark (e.g. >=95% verdict-agreement + a quarantine-recall floor). NOT batchable until the corpus has accumulated enough labeled volume — an OPERATIONAL gate beyond #511/#512: the dev gate must run a real vision provider over many captures to fill items/ + quarantine/ (design-refs/items/ holds only ~16 captures today — far below distillation volume). Slice C of epic #490.

**Parked (2026-06-14, batch pre-flight):** the operational corpus-volume gate above is unmet (~16 captures vs distillation volume), so the resolved #511/#512 DAG edges falsely surface this as Tier-A. Un-park once `design-refs/items/` + `quarantine/` hold enough labeled captures to distill.
