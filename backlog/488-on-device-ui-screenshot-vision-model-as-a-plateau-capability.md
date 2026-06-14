---
type: decision
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
preparedDate: "2026-06-13"
relatedReport: reports/2026-06-13-on-device-ui-vision-capability.md
tags: [plateau, monetization, vision, on-device, linear-cost, distillation, swappable-provider]
---

# On-device UI-screenshot vision model as a Plateau capability (linear-cost rule)

## Digest

No on-device model exists yet. **Prepared**: five forks grounded in the published
[`on-device-ui-vision`](/research/on-device-ui-vision/) topic, each with a **bold** default. Plateau's
hard rule — cost must scale ~linearly with revenue — means a flat-subscription feature can't depend on
an uncapped per-call vision SDK. The capability survey is decisive: the gate verdict is *coarse screen
classification* (Enrico: 75% top-1 across 20 classes from the screenshot alone; ours is 6 classes), so a
≲10 MB distilled classifier runs **in-browser on any device** — the fixed-cost floor is feasible *now*.
**Framing (author steers): this is a moving target — set graduation benchmarks, keep the API as the
always-on bridge, re-assess on a cadence, and codify the training so switching base models re-applies the
recipe rather than re-labelling. Decisions are targets, not rejections.**

> **Decision status: RESOLVED — ratified in full (2026-06-13).** All five forks adopted at their
> recommended defaults: **F1** Tier-1 verdict classifier now (graduation-benchmark gated) + Tier-2 VLM
> tracked, not rejected · **F2** distil from the #489 corpus · **F3** in-browser WebGPU (Tier 1) ·
> **F4** on-device floor + API/BYO-key as always-on bridge & premium upgrade · **F5** codify training as
> a model-agnostic artifact (corpus+recipe+benchmark) + scheduled frontier re-benchmark. The hosted-API
> provider (#485) is the bridge, not interim-throwaway. Build successor → **#490**, blocked on #489.

## The axis being decided

Five orthogonal axes, each pinned to the real tree:

- **Which capability *tiers* to build on-device, and their *graduation benchmarks*** — the verdict is a
  6-class problem (`scripts/design-refs/vision.mjs:15` `VERDICTS`); a classifier clears it, a VLM is a
  separate tier. *Fork 1.*
- **How the model is *built*** — distil from the corpus, fine-tune an open model, or train from scratch.
  The labeled set is collected by [#489](489-archive-quarantined-frames-persist-frame-verdict-pairs-as-a-/).
  *Fork 2.*
- **Where it *runs*** — in-browser (WebGPU) vs native/local-process. *Fork 3.*
- **Pricing *tiering* and the bridge** — on-device floor + API upgrade vs per-usage-only; the API
  provider already exists (`scripts/design-refs/providers/anthropic-vision.mjs`) as the bridge. *Fork 4.*
- **Staying current — *re-assessment cadence* + *codified, re-applicable training*** — the frontier
  moves; the durable assets are the corpus + recipe + benchmark, not any one model. *Fork 5.*

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Tiers + benchmarks | **Tier-1 verdict classifier now (clears feasibility); Tier-2 VLM tracked against a benchmark, not rejected** | Single monolithic VLM for everything | High |
| 2 · Build method | **Distil from the #489 corpus (VL2Lite/PAND-style KD from big-model verdicts)** | Fine-tune an open UI-VLM | Med-High |
| 3 · Runtime home | **In-browser via ONNX Runtime Web + WebGPU (truest on-device, zero install)** | Native/local-process | Med-High |
| 4 · Pricing + bridge | **On-device floor (as each tier graduates) + API/BYO-key as always-on bridge & premium upgrade** | Per-usage / BYO-key only | High |
| 5 · Stay-current | **Codify training as a model-agnostic artifact (corpus+recipe+benchmark) + scheduled re-benchmark of the frontier** | One-shot model pick, manual revisits | High |

## Fork 1 — Capability tiers and their graduation benchmarks

**Crux.** Treat this as *what to put on-device, and what bar each tier must clear to get there* — not a
yes/no on a single model. The frontier moves, so a tier below threshold today is "on the API bridge,"
never "rejected."

- **A — Tier-1 verdict classifier now; Tier-2 VLM tracked behind a benchmark (recommended).**
  *Tier 1* = a lightweight classifier for the 6-verdict gate; feasibility is already met (Enrico 75% on
  20 classes, ours is 6). Its **graduation benchmark**: ≥ an agreement threshold (e.g. ≥95% verdict
  agreement with the hosted model on a held-out slice of the #489 corpus, with quarantine recall ≥ a
  floor) → promote to the on-device default. *Tier 2* = a small VLM for tagging / element-detection;
  define its benchmark (e.g. element-detection IoU / tag-F1) and **keep it as a tracked target**, on the
  API bridge until a small model clears it.
- **B — One monolithic VLM for everything.** *Rejected:* over-couples a cheap solved task (the verdict)
  to a hard heavy one (structure); a VLM is the ≲2B device-ceiling lift where a ≲10 MB classifier wins.
  Separate the tiers (decouple bias).

**Ruling: A (ratified 2026-06-13).**

## Fork 2 — Build method

**Crux.** How do we get the Tier-1 classifier?

- **A — Distil from the #489 corpus (recommended).** Task-specific knowledge distillation (VL2Lite,
  PAND, VLM-KD) from the big-model verdicts the dev gate already produces into a MobileNet/ViT student.
  The data is free (the dev gate is the labeling pipeline), and the recipe is reproducible.
- **B — Fine-tune an open UI model** (Florence-2 / SmolVLM / an Enrico-trained classifier). *Viable
  alternative*, heavier; revisit if distillation underperforms the benchmark.
- **C — Train from scratch.** *Rejected for v1:* needless when distillation + transfer learning exist.

**Ruling: A (ratified 2026-06-13).**

## Fork 3 — Runtime home

**Crux.** Where does the on-device model execute?

- **A — In-browser via ONNX Runtime Web + WebGPU (recommended).** The truest "on-device, no install, no
  hosting" shape (the open-core *self-run* ideal, [#089](/backlog/089-monetization-product-ideas/)). A
  ≲10 MB quantized classifier runs everywhere; transformers.js/ORT-Web is mature.
- **B — Native / local-process** (Core ML / llama.cpp / ONNX native). *Kept for the Tier-2 VLM* if it
  needs more than WebGPU gives on weaker devices; not needed for the classifier.

**Ruling: A for Tier 1 (ratified 2026-06-13); revisit B for Tier 2.**

## Fork 4 — Pricing tiering and the always-on bridge

**Crux.** How do features stay shippable *now* while the on-device tier matures, without breaking the
linear-cost rule?

- **A — On-device floor + API/BYO-key bridge & upgrade (recommended).** Each tier ships on the hosted
  API/BYO-key provider (`anthropic-vision.mjs`) immediately; as a tier graduates (Fork 1 benchmark), its
  on-device model becomes the bundled, fixed-cost default, with the API staying as an optional
  higher-quality upgrade. Linear-safe at the floor, premium path on top, never blocked on the model.
- **B — Per-usage / BYO-key only.** *Rejected as the end state:* can't underpin a flat subscription and
  pushes a metered bill onto the user — though it *is* the bridge in (A) until graduation.

**Ruling: A (ratified 2026-06-13).**

## Fork 5 — Staying current: cadence + codified, re-applicable training

**Crux.** AI moves fast and we'll switch base models. What's the durable, re-runnable asset, and how
often do we re-check?

- **A — Codify training as a model-agnostic artifact + scheduled re-benchmark (recommended).** The kept
  assets are the **labeled corpus (#489) + the distillation recipe + the benchmark suite** — versioned,
  reproducible, model-independent. Switching base model = **re-run the recipe**, never re-label. A
  **recurring re-benchmark** (the [#192](/backlog/192-longitudinal-research-freshness-system/) dated-
  revision / gap-sweep cadence — e.g. quarterly) re-scores the small-model frontier against each tier's
  graduation benchmark and flips a tier on-device the moment it clears. This is minimize-lock-in applied
  to the *model itself*: the model is swappable, the training pipeline is the moat.
- **B — One-shot model pick, manual revisits.** *Rejected:* a frozen model decays as the frontier moves;
  un-codified training can't be re-applied to a better base without redoing the work.

**Ruling: A (ratified 2026-06-13).** *(Sub-decision, build-time: the exact cadence + benchmark thresholds are tunable; keep
them config + a dated-revision log, not constants.)*

## Per-fork classification (recorded)

Not a WE standard — an **implementation behind the existing swappable vision-provider seam**
(`scripts/design-refs/vision.mjs` → `registerVisionProvider`), so the **no-leakage invariant holds**
(only verdicts/outputs reach the standard). DI-injectable: the model *is* a registered provider.
Whole-axis exposed: tiered + swappable. Most-permissive default: the in-browser classifier runs for
everyone; richer/API is opt-in. Separate-and-decouple: classifier-tier and VLM-tier are distinct
providers/builds, not a monolith (Fork 1B rejected on that ground). Per #091 layering, the served
capability is a Plateau/impl concern, not a WE-standard artifact.

## Relationships

- **#475** — vision is a Plateau service consumed as a no-leakage client; this decides the *target provider* behind it.
- **#086** — mockup-to-standard is the highest-value consumer; its flat-vs-metered pricing hinges on this.
- **#480 / #485** — shipped gate + interim API provider (the bridge); stays dev/interim regardless.
- **#489** — collects the labeled (frame, verdict) corpus — the distillation dataset (Fork 2) and benchmark set (Fork 5).
- **#192** — the longitudinal / dated-revision cadence model reused for Fork 5's re-benchmark.
- **#089** — monetization (open-core; self-run > single-service; on-device = the cleanest self-run shape).
