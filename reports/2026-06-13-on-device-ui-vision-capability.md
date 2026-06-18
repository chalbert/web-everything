# On-device UI-screenshot vision — capability ceiling, runtimes, and distillation
**Date**: 2026-06-13
**Point**: The gate verdict is *coarse screen classification*, which a tiny task-specific image classifier (distilled from big-model labels) solves and runs in-browser on any device — so an owned, fixed-cost on-device floor is feasible *now*; a small on-device VLM (SmolVLM/Moondream/Florence-2 class, <2B device ceiling) is a separate, heavier tier for richer tagging/element-detection. This grounds backlog #488 (on-device vs per-usage, linear-cost rule).
**Research page**: `/research/on-device-ui-vision/`
---

## Question

Backlog [#488](backlog/488-on-device-ui-screenshot-vision-model-as-a-plateau-capability.md) asks
whether to back Plateau's vision-dependent features with an **owned on-device model** (fixed cost →
flat-rate-safe under the linear-cost rule) instead of, or alongside, a per-call hosted SDK. The open
sub-question — *what can an on-device UI-vision model actually do, and is it feasible now?* — had no
analysis. This survey provides it.

## Recommendation

**Two capability tiers, build the cheap one first.**

1. **Verdict floor — a lightweight task-specific classifier (feasible now).** The gate verdict
   (app / obstructed / marketing / error / blank / non-app — 6 classes) is *coarse screen
   classification*, not generative understanding. Enrico (a Rico subset) shows the **screenshot
   representation alone classifies UI screens at ~95% AUC / 75% top-1 across 20 design topics** with a
   lightweight classifier; 6 classes is strictly easier. A small ViT / MobileNet / ResNet-18 (≲10 MB
   quantized) runs **in-browser via WebGPU on any device** — true zero-marginal-cost. It is
   **distillable from the big-model verdicts** the dev gate already produces (VL2Lite, PAND, VLM-KD are
   established task-specific KD methods), so #489's labeled corpus is the training set.
2. **Richer tier — a small on-device VLM (heavier, later).** Tagging, element/region detection, and
   structure recovery need a VLM: SmolVLM (256M / 500M / 2.2B), Moondream (0.5B distil / 1.86B),
   Florence-2 (0.27B, 768px), TinyClick (GUI). These run on-device but at the **practical ≲2B ceiling**
   — WebGPU needs ~2 GB+ GPU memory and q4/q8 quantization; mobile is flagship-only. Structure recovery
   stays hard (Design2Code SOTA still ≈76 — see [design-ref-vision](/research/design-ref-vision/)).

So the linear-cost floor is buildable now with a classifier; the VLM tier is a separate, optional build.

## Key Findings

| Source | What it is | What we take |
|---|---|---|
| **Enrico** (Rico subset, Leiva et al.) | 1,460 UIs × 20 design topics; **screenshot alone → 95% AUC / 75% top-1** with a lightweight classifier (random = 5%). | UI *screen classification* is a solved, lightweight task. Our 6-class verdict is easier — a small CNN/ViT suffices; **no VLM needed for the gate floor.** |
| **VL2Lite** (CVPR 2025), **PAND**, **VLM-KD** | Task-specific knowledge distillation from a large VLM into MobileNet-V2 / ResNet-18 students. | The on-device classifier is **distilled from the big-model verdicts** — exactly the (frame, verdict) pairs #489 collects. The dev gate *is* the data pipeline. |
| **SmolVLM** (256M/500M/2.2B), **Moondream** (0.5B/1.86B), **Florence-2** (0.27B, 768px, ~250 ms), **TinyClick** | Small VLMs for UI/screenshot understanding; Moondream-0.5B is explicitly an edge distillation target. | The *richer* tier (tagging/element-detection) is feasible on-device at the small end, but it's a heavier model and a bigger lift than the classifier floor. |
| **transformers.js on ONNX Runtime Web + WebGPU** | In-browser inference; quantized models **<2 GB run at interactive speed** (<1B trivial); dtype q4/q8; mobile needs a flagship (iPhone 15 Pro / 8 GB Android) for the larger end. | The runtime exists and is mature — **in-browser is the truest "on-device, no install, no hosting"** home. A ≲10 MB classifier runs everywhere; a ≲2B VLM runs on capable devices only. |
| **Ternarization of VLMs for edge** (arXiv 2504.06298) | Extreme quantization for edge VLM deployment. | Headroom exists to push the VLM tier onto weaker devices later if needed. |

### Why this reshapes #488's single fork into four axes

The original item framed one fork (per-usage-only vs on-device-default). The survey splits the concern
into orthogonal axes: **which capability tier** to build on-device (classifier vs VLM), **how** to build
it (distill vs fine-tune vs scratch), **where it runs** (in-browser vs native), and **the pricing
tiering** (on-device floor + API upgrade vs per-usage-only). Each is now independently decidable.

### Architecture fit — it's a provider swap, not new plumbing

The on-device model is an **implementation behind the existing swappable vision-provider seam**
(`we:scripts/design-refs/vision.mjs` → `registerVisionProvider`), the same seam #475 ruled and #480/#485
built. So adding an on-device classifier is registering another provider; the WE standard never imports
it and the **no-leakage invariant holds** (only verdicts/outputs flow on). Per the #091 layering, the
*served capability* is a Plateau/impl concern, not a WE-standard artifact.

## Files Created/Modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics.json` | Added `on-device-ui-vision` topic |
| `we:src/_includes/research-descriptions/on-device-ui-vision.njk` | Wrote the research write-up |
| `backlog/488-…md` | Rewrote to prepared-fork shape (4 forks), set `preparedDate` |
| `we:reports/2026-06-13-on-device-ui-vision-capability.md` | This report |
