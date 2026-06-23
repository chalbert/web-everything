---
kind: decision
parent: "490"
status: open
blockedBy: []
dateOpened: "2026-06-14"
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
#512 benchmark auto-decides — not a human-judgment fork. So this item is **not** a design decision; it is
the operational **training-readiness gate**: a single go/no-go on whether the design-ref corpus is large +
balanced enough to distil a passing student yet. Grounded in the
[`/research/verdict-classifier-training-readiness-gate/`](/research/verdict-classifier-training-readiness-gate/)
topic, the forced ruling today is **WAIT** — the corpus holds zero labeled captures, so the proceed-now
branch cannot clear the floors and there is nothing to ratify until the un-block trigger fires.

## Axis-framing — what's settled, and the one operational call

The build is mechanical: run the codified #511 recipe (`we:design-refs/distillation-recipe.json` v2,
`we:scripts/design-refs.mjs export`) over the labeled corpus, quantize to ≤10MB, register the ONNX/WebGPU
provider behind the `we:scripts/design-refs/vision.mjs:149` `registerVisionProvider` seam, and gate on the
#512 benchmark (`we:scripts/design-refs/benchmark.mjs`, floors ≥0.95 agreement / ≥0.98 quarantine-recall).
The single axis is **operational corpus volume**: the label IS each frame's `visionVerdict`, written only
when a real vision provider runs via `we:scripts/design-refs.mjs collect`/`harvest` (opt-in
`DESIGN_REFS_VISION_PROVIDER`). Today the corpus is unlabeled, so the floors are not even *measurable*:

- `we:design-refs/items/` — **16** captures; `we:design-refs/quarantine/` — **0** captures.
- `we:design-refs/training-manifest.json` — `counts.total: 0`, `counts.unlabeled: 16`, `train: 0`,
  `holdout: 0`, `byVerdict: {}` — **every shot ungated; zero labeled training examples and zero labeled
  holdout.**

KD prior art grounds the threshold: task-specific KD into lightweight students (the VL2Lite/VLM-KD/DHO
methods #490 names) reports its low-data regime as K-shot × C-class, N = K×C, with **16-shot** the empirical
low-data knee. For the 6-verdict taxonomy that floors a usable set at **N ≈ 16×6 ≈ 96 labeled captures**,
balanced ~16 per verdict — and the **binding** constraint is the rare quarantine tail under the 0.98 recall
floor.

## Recommended path at a glance

| Branch | Recommendation | Confidence |
| --- | --- | --- |
| Proceed-to-train now vs WAIT-for-corpus | **WAIT** — proceed-now is broken below the corpus floor (0 labeled captures cannot clear the #512 floors); not a fork, a forced invariant | High |

**Ratify (forced invariant):** WAIT — the proceed-now branch is broken below the corpus threshold; distilling
from 0 labeled captures cannot clear the #512 floors, so there is nothing to ratify yet.

**Un-block trigger (grounded, numeric).** The proceed branch goes live once
`we:scripts/design-refs.mjs collect`/`harvest` has run a real vision provider so the manifest reports:
(1) **≥~96 labeled captures total** (the N = 16×6 low-data floor), (2) **≥16 labeled examples in EACH of the
four quarantine classes** (marketing/error/blank/non-app — the binding 0.98-recall constraint, not the
common `app` class), and (3) a **non-empty labeled holdout split** (`holdoutFraction 0.15`). Then the
mechanical #511 recipe runs and the #512 benchmark decides the student; retype to a `story` and resolve by
building.

**Skeptic:** *Is the threshold right — could a smaller corpus work?* For the easy `app` ↔ `non-app` split,
plausibly — but the real bar is **0.98 quarantine-recall on the rare tail**, and a sub-16-per-quarantine-class
corpus cannot reliably clear a 0.98 recall floor (too few tail positives to estimate, let alone hit, 0.98).
Lowering the threshold silently takes the worse default the 0.98 floor exists to prevent (junk admitted into
the corpus). **SURVIVES.**

## Context

- **Lineage / sequencing.** Slice C of epic
  [#490](/backlog/490-build-the-on-device-verdict-classifier-codified-distillation/). Its DAG predecessors
  are resolved: #511 (recipe + export) and #512 (benchmark + finalized 0.98 floor) build against the corpus
  *format* and need no real data; this slice needs accumulated *data*. It stays an **open decision** (the
  honest held state; soft parks retired per #1392/#1620) rather than a ready story, so the resolved
  #511/#512 edges don't falsely surface it as Tier-A build work.
- **No-leakage boundary.** The on-device provider self-registers behind the same vendor-free seam as the
  hosted provider ([no-leakage-client](docs/agent/platform-decisions.md#no-leakage-client), #475); the
  teacher identity lives in each frame's `visionVerdict.provider`, never in the recipe.
