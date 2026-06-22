---
kind: decision
parent: "490"
status: open
blockedBy: []
dateOpened: "2026-06-14"
tags: []
---

# Train + quantize the distilled verdict classifier — <=10MB ONNX student (per #488 F1/F2, the [no-leakage-client](docs/agent/platform-decisions.md#no-leakage-client) rule)

**Held open in the decision lane — a go/no-go training-readiness gate, not a design fork.** All five #488
*design* forks are **already ratified** in [#490](/backlog/490-build-the-on-device-verdict-classifier-codified-distillation/)'s
spec (model = ≲10 MB MobileNet/ViT student via task-specific KD; runtime = ONNX Runtime Web + WebGPU;
recipe codified in #511; graduation benchmark + ≥0.98 quarantine-recall floor built in #512). The
student-architecture (`MobileNet` vs `ViT`) and distillation-method (`VL2Lite`/`PAND`/`VLM-KD`) choices are
**empirical model-selection** the #512 benchmark auto-decides (whichever clears ≥95 % verdict-agreement +
≥0.98 quarantine-recall under the ≤10 MB budget) — not a human-judgment fork. So the build itself is
mechanical (run the codified #511 recipe). The **only** open call is the operational go/no-go: *is the
design-ref corpus large + representative enough to distill a passing student yet?*

## The call — proceed-to-train vs wait-for-corpus

Run slice A's (#511) recipe against the accumulated design-ref corpus to produce a ≤10 MB-quantized
student for the 6-verdict taxonomy, gated by slice B's (#512) benchmark. The gate is **operational corpus
volume**: the dev gate must run a real vision provider over many captures to fill `we:design-refs/items/`
+ `we:design-refs/quarantine/`, which hold only **~16 captures today** — far below distillation volume.

- **Today the answer is forced: wait.** Distilling from ~16 captures cannot clear the #512 floors — the
  "proceed now" branch is broken, so there is nothing to ratify yet. This item stays an **open decision**
  (the decision lane is the honest held state; parking-as-deferral is retired per #1392) rather than a
  ready story, so the resolved #511/#512 DAG edges don't falsely surface it as Tier-A build work.
- **Un-block trigger:** once `we:design-refs/items/` + `we:design-refs/quarantine/` hold enough labeled
  captures to distill (the `collect`/`harvest` accumulation), the "proceed" branch becomes live — ratify
  it and the mechanical build runs. At that point this can be retyped to a `story` and resolved by
  building, or simply built.
