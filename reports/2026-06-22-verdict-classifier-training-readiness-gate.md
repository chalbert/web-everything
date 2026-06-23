# Verdict-classifier training-readiness gate — prep research (#513)

**Date:** 2026-06-22
**Decision:** [#513](/backlog/513-train-quantize-the-distilled-verdict-classifier-10mb-onnx-st/) — Train + quantize the distilled verdict classifier (≤10MB ONNX student)
**Research topic:** `/research/verdict-classifier-training-readiness-gate/`
**Verdict shape:** single **forced invariant** (WAIT) + a grounded numeric un-block trigger. **No design forks** — the design is ratified upstream.

## What this gate is (and is NOT)

#513 is **not** a multi-fork design decision. All five #488 design forks are already ratified and codified
in [#490](/backlog/490-build-the-on-device-verdict-classifier-codified-distillation/)'s spec:

- **Model (F1/F2):** ≤10MB-quantized MobileNet/ViT student via task-specific KD (VL2Lite / PAND / VLM-KD).
- **Runtime (F3):** ONNX Runtime Web + WebGPU provider behind the existing
  `we:scripts/design-refs/vision.mjs` → `registerVisionProvider` seam (same no-leakage boundary as the
  hosted provider — [no-leakage-client](../docs/agent/platform-decisions.md#no-leakage-client), #475).
- **Codified training (F5):** the versioned recipe `we:design-refs/distillation-recipe.json` (v2).
- **Graduation benchmark (F1/F4):** `we:scripts/design-refs/benchmark.mjs` (#512) — ≥0.95 verdict-agreement
  + ≥0.98 quarantine-recall on the held-out split.

The student-architecture (`MobileNet` vs `ViT`) and KD-method choices are **empirical model-selection the
#512 benchmark auto-decides** (whichever clears both floors under the ≤10MB budget) — not human judgment.
So the build is **mechanical** (run the #511 recipe). The only open call is the **operational go/no-go**:
is the corpus large + balanced enough yet?

Fork-existence test applied honestly: there is **one** forced invariant (WAIT) + the operational trigger.
"Proceed now on 0 labeled captures" is not a coherent competing end-state — it simply fails the benchmark —
so it is not a fork.

## The grounded corpus count (verified, not asserted)

| Source | Reading |
| --- | --- |
| `ls we:design-refs/items/` | **16** captures |
| `ls we:design-refs/quarantine/` | **0** captures |
| `we:design-refs/training-manifest.json` | `counts.total: 0`, `counts.unlabeled: 16`, `train: 0`, `holdout: 0`, `byVerdict: {}` |

The decisive fact is not "16 vs 96" — it is that **all 16 are ungated** (no `visionVerdict`), so the labeled
training set and the labeled holdout are both **empty**. Per #511's resolution note: the label IS the model
verdict; ungated shots are excluded and counted `unlabeled`, never inferred. Per #512's resolution note: the
benchmark scores 0 held-out frames today — "the honest pre-vision baseline." **The #512 floors are not even
measurable** until a vision provider runs (`we:scripts/design-refs.mjs collect`/`harvest`, opt-in via
`DESIGN_REFS_VISION_PROVIDER`, writes the per-item `visionVerdict`; the `export` verb then turns gated items
into labeled records).

## KD sample-size prior art — turning "wait" into a threshold

The methods #490's recipe names define their low-data regime as **K-shot × C-class, N = K×C labeled
samples**:

- **DHO** (semi-supervised KD from VLMs, dual-head; arXiv 2505.07675) — evaluates 1/2/4/8/**16-shot** across
  11 datasets; 16-shot is the standard low-data benchmark and the reported sweet spot. For ImageNet (1000
  classes) the shot grid is literally 1k/2k/4k/8k/**16k** labeled total.
- **VL2Lite** (CVPR 2025) — task-specific KD from a large VLM into lightweight students (MobileNet / ViT
  class) using domain-specific distillation; same K-shot framing.
- **VLM-KD** (arXiv 2408.16930) — KD from an off-the-shelf VLM for long-tail recognition; explicitly targets
  the **rare-tail** classes, which is exactly our quarantine-recall constraint.
- Broader few-shot literature: the **10–16-shot** range is the cost-effective knee; performance plateaus
  quickly in samples-per-class and gains more from more classes — so for a fixed 6-class taxonomy the
  per-class shot count is the lever.

### The corpus-volume math (6-verdict taxonomy)

- Low-data floor: **N ≈ 16-shot × 6 classes ≈ 96 labeled captures**, balanced ~16 per verdict.
- **Binding constraint = the quarantine tail.** The four quarantine classes (marketing / error / blank /
  non-app) are rarer than `app`, and the **≥0.98 quarantine-recall** floor sits on them. You cannot estimate
  — let alone clear — 0.98 recall from a handful of positives, so the real bar is **≥16 labeled examples in
  EACH quarantine class**, not just 96 total dominated by `app`.
- **Holdout.** `holdoutFraction 0.15` means a non-empty labeled holdout is needed merely to *score* the
  gate; the ~96 must be on top of (or split to leave) a populated holdout.

## Ruling + un-block trigger

**Forced invariant: WAIT.** Distilling from 0 labeled captures cannot clear the #512 floors — nothing to
ratify. #513 stays an open decision (the honest held state; soft parks retired per #1392/#1620) so the
resolved #511/#512 DAG edges don't falsely surface it as Tier-A build work.

**Un-block trigger (grounded, numeric).** Proceed-branch goes live once the manifest reports:

1. **≥~96 labeled captures total** (the N = 16×6 low-data floor), AND
2. **≥16 labeled examples in EACH of the four quarantine classes** (the binding 0.98-recall constraint), AND
3. a **non-empty labeled holdout split** (`holdoutFraction 0.15`).

Then the mechanical #511 recipe runs and the #512 benchmark auto-decides the student; #513 retypes to a
`story` and resolves by building.

**Skeptic (attacking the WAIT ruling).** *Is the threshold right — could a smaller corpus work?* For the
easy `app` ↔ `non-app` split, plausibly. But the real bar is **0.98 quarantine-recall on the rare tail**, and
a sub-16-per-quarantine-class corpus cannot reliably clear a 0.98 recall floor (too few tail positives to
estimate recall, let alone hit it). The threshold is the binding tail count, and lowering it silently takes
the worse default (admitting junk into the corpus — the asymmetric error the 0.98 floor exists to prevent).
**SURVIVES.**

## Sources

- [Dual-Head Optimization — semi-supervised KD from VLMs (arXiv 2505.07675)](https://arxiv.org/html/2505.07675) — K-shot × C-class regime; 16-shot sweet spot across 11 datasets.
- [VL2Lite — Task-Specific KD from Large VLMs to Lightweight (CVPR 2025)](https://openaccess.thecvf.com/content/CVPR2025/papers/Jang_VL2Lite_Task-Specific_Knowledge_Distillation_from_Large_Vision-Language_Models_to_Lightweight_CVPR_2025_paper.pdf)
- [VLM-KD — KD from VLM for Long-Tail Visual Recognition (arXiv 2408.16930)](https://arxiv.org/html/2408.16930v1) — rare-tail focus mirrors the quarantine-recall constraint.
- [Few-Shot Learning: How Much Data Is Enough? (MobiDev)](https://mobidev.biz/blog/few-shot-learning-explained-examples-applications-research) / [Impact of base dataset design on few-shot classification (arXiv 2007.08872)](https://arxiv.org/pdf/2007.08872) — 10–16-shot knee; classes > samples-per-class.
