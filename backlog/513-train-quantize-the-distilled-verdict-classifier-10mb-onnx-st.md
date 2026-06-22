---
kind: story
size: 5
parent: "490"
status: parked
parkedReason: deferred
blockedBy: []
dateOpened: "2026-06-14"
tags: []
---

# Train + quantize the distilled verdict classifier — <=10MB ONNX student (per #488 F1/F2, the [no-leakage-client](docs/agent/platform-decisions.md#no-leakage-client) rule)

**Execution slice C of epic #490 — not a decision.** All five #488 design forks are *already ratified*
in [#490](/backlog/490-build-the-on-device-verdict-classifier-codified-distillation/)'s spec (model =
≲10 MB MobileNet/ViT student via task-specific KD; runtime = ONNX Runtime Web + WebGPU; recipe codified
in #511; graduation benchmark + floors built in #512). The student-architecture (`MobileNet` vs `ViT`)
and distillation-method (`VL2Lite`/`PAND`/`VLM-KD`) options are **empirical model-selection** the #512
benchmark auto-decides (whichever clears ≥95 % verdict-agreement + ≥0.98 quarantine-recall under the
≤10 MB budget) — not a human-judgment fork. So there is nothing to ratify here; this is a build that runs
the codified recipe once the data exists.

Run slice A's (#511) recipe against the accumulated design-ref corpus to produce a ≤10 MB-quantized
student for the 6-verdict taxonomy via task-specific knowledge distillation from the big-model labels,
gated by slice B's (#512) benchmark.

**Parked (`deferred`) on an operational corpus-volume gate.** The dev gate must run a real vision
provider over many captures to fill `design-refs/items/` + `quarantine/` — which hold only **~16
captures today**, far below distillation volume. **Un-park trigger:** once `design-refs/items/` +
`quarantine/` hold enough labeled captures to distill (the `collect`/`harvest` accumulation), flip
`parked → open` and build. The resolved #511/#512 DAG edges would otherwise falsely surface this as
ready Tier-A work; the park keeps it out of the pool until the data is real.
