---
kind: story
size: 3
parent: "1073"
status: resolved
dateOpened: "2026-06-19"
relatedReport: reports/2026-06-19-small-vlm-candidate-eval.md
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:scripts/design-refs/vision-tier2-eval.mjs"
tags: []
---

# Small-VLM candidate selection + offline eval harness

Slice B of #1073: pick a small-VLM candidate (SmolVLM / Moondream / Florence-2 class, ≲2B) and build an OFFLINE eval that scores it on the OBJECTIVELY-measurable capabilities (tagging, element/region detection) against a held-out set. Scoped to objective capabilities on purpose so it does NOT wait on the #1034 critique rubric; the critique-quality benchmark folds in once #1034 lands. Independent, startable now; demoable as a dated eval report ranking candidates. Feeds slice C.

## Progress

Shipped the Tier-2 offline eval harness + candidate selection:
- `we:scripts/design-refs/vision-tier2-eval.mjs` — pure, provider-agnostic scorers for the OBJECTIVE
  capabilities: `scoreTagging` (multi-label set P/R/F1), `iou` + `scoreDetection` (label-matched greedy
  IoU localization), `scoreSample`/`scoreCandidate`/`rankCandidates`. Consumes the #1080
  `normalizeRichOutput` contract; detection averaged only over boxed samples (no vacuous-1.0 inflation);
  missing prediction = a miss not a drop. No-leakage (#475): no vendor in the core.
- `we:scripts/design-refs/__tests__/vision-tier2-eval.test.mjs` — 15 tests green (fixture-only, no model/browser).
- `we:reports/2026-06-19-small-vlm-candidate-eval.md` — dated candidate ranking on the two objective axes:
  **Florence-2 recommended** for slice C (native region/detection head — the localization Tier 1 #490
  can't do — + smallest footprint), Moondream the description-led fallback, SmolVLM the efficiency floor.

Critique-quality benchmark deliberately excluded (subjective, folds in once #1034 lands; the combined
score takes a third weighted axis without a rewrite). Unblocks slice C (#1082 wrap Florence-2); the
labelled held-out corpus is slice E (#1084).
