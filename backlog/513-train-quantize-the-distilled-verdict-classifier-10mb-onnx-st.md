---
kind: story
size: 5
parent: "490"
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: we:design-refs/training-manifest.json shows >=16 labeled captures in EACH quarantine class (marketing/error/blank/non-app) plus a non-empty labeled holdout (>=96 labeled total as a derived sanity check)"
blockedBy: []
dateOpened: "2026-06-14"
dateStarted: "2026-06-23"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-verdict-classifier-training-readiness-gate.md
tags: []
---

# Train + quantize the distilled verdict classifier — <=10MB ONNX student (per #488 F1/F2, the [no-leakage-client](docs/agent/platform-decisions.md#no-leakage-client) rule)

The design is fully ratified upstream: all five #488 design forks are codified in
[#490](/backlog/490-build-the-on-device-verdict-classifier-codified-distillation/)'s spec (≤10MB
MobileNet/ViT student via task-specific KD, ONNX Runtime Web + WebGPU runtime, recipe in #511, the
≥0.95 verdict-agreement / ≥0.98 quarantine-recall graduation floors in #512). The student-architecture
(`MobileNet` vs `ViT`) and KD-method (`VL2Lite`/`PAND`/`VLM-KD`) choices are empirical model-selection the
#512 benchmark auto-decides — not a human-judgment fork. So this is slice C of #490: the **mechanical
training build**, gated only by corpus maturity.

**Training-readiness ruling (2026-06-23).** This was briefly framed as a held `decision` (proceed-to-train
vs wait). That framing was wrong: the proceed branch is *broken* below the corpus floor, not chosen — there
is no human fork. The genuine call (the readiness threshold) is now **ratified** and encoded as the
`maturityTrigger` below, and the item is remodeled from a held decision into a **`maturityGated` story** (per
#1620 — building now would yield a worse artifact: a student tuned against zero real labels). This drops it
out of both the decision lane and the Tier-A ready pool, and the gate-typed trigger auto-surfaces it when the
corpus fills. The earlier "hold it open as a decision" framing posed a false dichotomy (open-decision vs
ready-story) and missed the codified third option; `maturityGated` is the honest home.

## The mechanical build (unparks when the corpus is ready)

Run the codified #511 recipe (`we:design-refs/distillation-recipe.json`, `we:scripts/design-refs.mjs
export`) over the labeled corpus, quantize to ≤10MB, register the ONNX/WebGPU provider behind the
`we:scripts/design-refs/vision.mjs` `registerVisionProvider` seam, and gate on the #512 benchmark
(`we:scripts/design-refs/benchmark.mjs`, floors ≥0.95 agreement / ≥0.98 quarantine-recall). The
architecture/KD-method are whatever clears the floors under the ≤10MB budget — the benchmark decides, no
human call.

## Corpus state — why it's parked (grounded 2026-06-23)

The label IS each frame's `visionVerdict`, written only when a real vision provider runs via
`we:scripts/design-refs.mjs` `collect`/`harvest` (opt-in `DESIGN_REFS_VISION_PROVIDER`). Today the corpus is
unlabeled, so the floors are not even *measurable*:

- `we:design-refs/items/` — **16** captures; `we:design-refs/quarantine/` — **0** captures.
- `we:design-refs/training-manifest.json` — `counts.total: 0`, `counts.unlabeled: 16`, `train: 0`,
  `holdout: 0`, `byVerdict: {}` — every shot ungated; zero labeled training examples and zero labeled
  holdout. (Manifest/recipe are still `version: 1`.)

## The ratified readiness threshold

KD prior art grounds it: task-specific KD into lightweight students reports its low-data regime as
K-shot × C-class (N = K×C), with **16-shot** the empirical low-data knee. For the 6-verdict taxonomy that
gives **N ≈ 16×6 ≈ 96 labeled captures**, ~16 per verdict.

**Ratified as a trigger to *attempt* training — not a guarantee of passing.** Two honesty caveats settled
in the 2026-06-23 discussion:

1. The **96-total is the weaker framing** (it assumes a balance the data won't have — `app` is common,
   quarantine classes rare). The **load-bearing constraint is per-class: ≥16 in EACH quarantine class**
   (marketing/error/blank/non-app). 96 total is a derived sanity check, not the gate.
2. Even ≥16/class is **marginal for the 0.98 quarantine-recall target** — a 0.15 holdout leaves only ~2–3
   tail positives per class to measure recall on, so one miss swings the measured rate wildly. So the
   threshold means "enough to *start trying*"; the corpus may need to grow well past 96 before the
   quarantine tail actually clears 0.98. **The #512 benchmark is the real arbiter.**

**Skeptic (survives):** could a smaller corpus work? For the easy `app` ↔ `non-app` split, plausibly — but
the real bar is 0.98 recall on the rare tail, and a sub-16-per-quarantine-class corpus can't reliably
*estimate*, let alone hit, 0.98. Lowering the floor silently takes the worse default the 0.98 gate exists to
prevent.

## Unpark mechanism

The `adoptionSignal` is **observed, not polled** — nothing auto-flips it. But the condition is a one-command
check against a file: read `we:design-refs/training-manifest.json` (`counts.byVerdict`, `holdout`). What
moves the needle is separate work — `we:scripts/design-refs.mjs` `collect`/`harvest` runs with a real vision
provider accumulating labels over time. When the manifest shows ≥16 per quarantine class + a non-empty
holdout, flip `status: parked → open` and strip `parkedReason`/`maturityTrigger`; it's already a story, so it
just becomes a normal ready build and the #512 benchmark arbitrates the student. (A future card could teach
`check:readiness` to auto-surface maturityGated items whose `adoptionSignal` names a manifest counter — out
of scope here.)

## Context

- **Lineage / sequencing.** Slice C of epic
  [#490](/backlog/490-build-the-on-device-verdict-classifier-codified-distillation/). DAG predecessors are
  resolved: #511 (recipe + export) and #512 (benchmark + finalized 0.98 floor) build against the corpus
  *format* and need no real data; this slice needs accumulated *data*.
- **No-leakage boundary.** The on-device provider self-registers behind the same vendor-free seam as the
  hosted provider ([no-leakage-client](docs/agent/platform-decisions.md#no-leakage-client), #475); the
  teacher identity lives in each frame's `visionVerdict.provider`, never in the recipe.
