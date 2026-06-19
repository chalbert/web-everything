# Small-VLM candidate selection + offline eval harness — first-cut

**Date:** 2026-06-19 · **Backlog:** [#1081](/backlog/1081-small-vlm-candidate-selection-offline-eval-harness/) (slice B of epic [#1073](/backlog/1073-on-device-small-vlm-vision-tier-tier-2/)) · **Feeds:** slice C (in-browser provider #1082)

**Point.** Pick a small-VLM candidate (≲2 B, the SmolVLM / Moondream / Florence-2 class) for the Tier-2
on-device vision tier, and stand up an **offline eval** that scores a candidate's rich output (the #1080
`{ description, tags, regions }` contract) on the **objectively-measurable** capabilities only —
**tagging** (multi-label set agreement) and **element/region detection** (IoU localization). Description /
critique quality is deliberately *out of scope* (subjective; waits on the #1034 critique rubric), which is
exactly what lets this slice land now as a hard, reproducible number.

## The harness (shipped)

[`we:scripts/design-refs/vision-tier2-eval.mjs`](../scripts/design-refs/vision-tier2-eval.mjs) — the
Tier-2 analogue of the Tier-1 verdict [`we:scripts/design-refs/benchmark.mjs`](../scripts/design-refs/benchmark.mjs). Pure,
deterministic, **provider-agnostic and no-leakage** (#475): it names no vendor and scores whatever
normalized rich-output the environment produced, so it is fixture-tested without a model or a browser
([`we:scripts/design-refs/__tests__/vision-tier2-eval.test.mjs`](../scripts/design-refs/__tests__/vision-tier2-eval.test.mjs),
15 tests green).

| Metric | What it scores | Definition |
|---|---|---|
| **Tagging F1** | multi-label tags vs ground truth | set precision/recall/F1, case-insensitive (post-#1080 normalizer) |
| **Detection F1** | element/region localization | a predicted region matches a same-label truth region at **IoU ≥ threshold** (default 0.5); greedy best-IoU, each truth consumed once |
| **Combined** | the rank key | weighted mean of the two (50/50 default); **detection is averaged only over samples with a boxed region** on either side, so region-less samples can't inflate the score with a vacuous 1.0 |

A missing prediction is scored as an empty rich-output — a no-answer is a miss, never a silent drop
(mirrors we:scripts/design-refs/benchmark.mjs). The candidate is named only in the eval **data** and this report, never in the
harness core.

## Candidate ranking (objective capabilities, ≲2 B class)

No held-out corpus is labelled yet (the labelling surface is slice E, #1084), so this first-cut ranking is
grounded in the candidates' **published** capabilities on the two objective axes, to pick the model slice C
wraps first. It is a *selection* call, not a measured leaderboard — the harness produces the measured
numbers once the labelled set exists.

| Rank | Candidate | Size | Tagging / captioning | Element-region detection | Notes |
|---|---|---|---|---|---|
| **1** | **Florence-2 (base/large)** | ~0.23 B / ~0.77 B | strong (caption, dense-caption, tags) | **native grounding + region detection** (`<OD>`, `<DENSE_REGION_CAPTION>`, region→box) | the only candidate with **first-class localization** — the capability Tier 1 (#490) structurally cannot do; smallest too |
| 2 | Moondream 2 | ~1.8 B | strong (caption, VQA, tags) | partial — point/region via prompt, weaker boxes | excellent compact describer; localization is promptable but not its native head |
| 3 | SmolVLM (256M/500M/2.2B) | 0.25–2.2 B | good (caption, VQA) | weak — no native detection head | the efficiency floor; best when only tagging/description is needed, not localization |

**Recommendation (slice C): Florence-2.** Its native region/detection head is the decisive factor — the
Tier-2 tier exists *because* Tier 1 is whole-screen-only with no localization
([`we:docs/agent/vision-tiers.md`](../docs/agent/vision-tiers.md)), so the candidate that scores on **both** objective
axes is the right first wrap. It is also the smallest of the three (base ~0.23 B), which fits the
device-gated WebGPU budget best. Confidence **medium** — strong on the capability match; the residual is
that Florence-2's tagging/description register is terser than Moondream's, so if the in-browser eval shows
tagging F1 lagging, Moondream is the fallback for description-led use while Florence-2 stays the detector.

## What this unblocks / leaves open

- **Slice C (#1082)** — wrap Florence-2 behind the #1080 `analyzeRich` envelope (WebGPU, opt-in download in
  the dev browser #141); run it through this harness against the first labelled batch.
- **Slice E (#1084)** — the per-screenshot review/tag UI that produces the labelled held-out corpus this
  harness scores against (currently the missing input).
- **#1034 critique rubric** — folds the subjective critique-quality benchmark in on top of these objective
  metrics once it lands; the harness's combined score is structured to take a third weighted axis without a
  rewrite.

## Prior art touchpoints

- **Florence-2** (Microsoft, 2024) — unified prompt-based vision: caption / detection / grounding / OCR
  from one ~0.2–0.8 B model; the region tasks are why it ranks first here.
- **Moondream 2** — ~1.8 B open VLM tuned for compact captioning/VQA; strong describer, promptable pointing.
- **SmolVLM** (HuggingFace) — 256 M–2.2 B efficiency-first VLMs; the smallest-footprint option, tagging/VQA
  rather than detection.
- **IoU / mAP** — the standard object-detection localization metric the detection scorer adopts (single
  IoU threshold here; a multi-threshold mAP sweep is a later refinement once the corpus is large enough).
