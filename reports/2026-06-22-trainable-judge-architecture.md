# Trainable judge architecture — prior-art survey + prepared-fork framing (#1553)

**Date:** 2026-06-22 · **For:** decision #1553 (child of epic #1552) · **Locus:** frontierui (explorer devtool)

The explorer's Layer-3 judge (`fui:tools/explorer/oracles/advisoryJudge.ts`,
`fui:tools/explorer/oracles/tier2VlmJudgeModel.ts`) is frozen + describe-only. Epic #1552 makes it
*trainable*: human feedback on real runs becomes labeled signal. #1553 settles the shape before any
build — **what the feedback signal is, how it's anchored, the learning mechanism, and where it lives.**

## Prior-art survey (the load-bearing findings)

| Area | Source | Takeaway |
|---|---|---|
| VLM-as-judge ceiling | WebVoyager ([2401.13919](https://arxiv.org/html/2401.13919v3)) | A screenshot+goal judge hits human-level agreement (κ=0.70) **only on a closed binary call with full visual context** — "is this broken + how severe" is harder and won't inherit that for free. |
| Judge reliability = calibration | LLM-as-a-Judge survey ([2411.15594](https://arxiv.org/pdf/2411.15594)); biases ([2410.02736](https://arxiv.org/pdf/2410.02736)) | Judge errors are **systematic/biased, not random** → human labels can correct them (a learnable signal). State of the art treats reliability as calibration, not prompt-tweaking — the trainable loop *is* that calibration. |
| Few-shot plateaus | ICL vs fine-tune ([2305.16938](https://aclanthology.org/2023.findings-acl.779.pdf)) | In-context examples are order/format-sensitive and plateau; training scales with data. |
| **Linear probe beats few-shot at *tens* of labels** | Logistic-regression probe ([2408.03414](https://arxiv.org/pdf/2408.03414)); CLIP probes ([2505.10664](https://arxiv.org/pdf/2505.10664)) | A **linear/logistic head on (V)LM embeddings** beats in-context prompting at the **tens-of-examples** scale, cheaper at inference, explainable, **trains in seconds on CPU**. The "classifier" rung is light + near-term, not heavy. |
| Fine-tune needs scale | Bucher & Martini 2024 ([pdf](https://ipz.uzh.ch/whp/wordpress/wp-content/uploads/2024/08/BucherMartini_2024_LLMs.pdf)) | Full fine-tune only pays off past **~1k labels** — premature for v1, breaks the on-device budget. |
| Recall needs a missed-issue channel | Active defect discovery ([IISE 2024](https://www.tandfonline.com/doi/abs/10.1080/24725854.2023.2224854)); missing-annotation loop ([Sensors 2025](https://www.mdpi.com/1424-8220/26/12/3912)) | Verdict-only labels (rating what the model already flagged) **cannot grow recall** — the canonical mechanism is "human authors a finding the model missed." |
| Anchor: boxes > selectors | Ferret-UI ([2404.05719](https://ar5iv.labs.arxiv.org/html/2404.05719)); ScreenAI/WebUI/Rico; self-healing locators ([2603.20358](https://arxiv.org/pdf/2603.20358)) | VLM grounding standardizes on **unit-normalized bounding boxes**, not selectors. **~73% of Selenium failures are locator drift** — a selector-only anchor silently detaches across re-renders. |
| On-device feasibility | Transformers.js v3 WebGPU ([HF](https://huggingface.co/blog/transformersjs-v3)) | ~2 GB quantized VLM = the on-device **inference** ceiling (not a training budget). But a **linear head on cached embeddings trains on-device** (CPU, seconds). |

## How the survey reshaped the forks (item said "two coupled forks")

- **Signal type (verdict / missed / both) is NOT a fork.** Verdict-only is *broken for recall* (the
  epic's whole point); missed-issue capture is composable, not exclusive → **support both** by default.
- **The real open question was the anchor** (the item flagged it as a residual) → elevated to **Fork 1**.
  Selector-only is the broken branch; a composite anchor wins.
- **The constellation boundary** (#1073/#475, which the preamble required grounding) → elevated to
  **Fork 3**. #475's no-leakage rule is *categorical* (vision judgment = Plateau), but the new wrinkle —
  label *capture* happens in the FUI-side `improve-explorer` loop and the exemplar v1 is thin enough to
  tempt a FUI-local home — makes it a genuine fork with a named excluded branch.
- **Learning mechanism stays Fork 2**, but the survey moves the escalation trigger *much earlier*: the
  linear-probe classifier beats few-shot at **tens** of labels and is **on-device**, so "exemplar-first"
  is really "exemplar-first, classifier-soon"; only fine-tune is far/server-side.

## Prepared forks (see #1553 body for full options + skeptic verdicts)

1. **Anchor** → composite: stateId (#1168 DOM signature) + normalized bbox primary + a11y-role/text +
   DOM-path as redundant re-match signals. (selector-only / stateId-only excluded.)
2. **v1 learning mechanism** → exemplar/few-shot retrieval now → linear-probe classifier on embeddings
   at ~tens of labels (eval-gated) → fine-tune parked past ~1k labels. (classifier-first / fine-tune-first excluded.)
3. **Constellation boundary** → trainable layer (store + retrieval + training) is a Plateau/WE service
   extending #1073/#475; FUI captures labels + consumes candidates via the `JudgeModel` seam (no-leakage).
   (FUI-local store excluded.)
