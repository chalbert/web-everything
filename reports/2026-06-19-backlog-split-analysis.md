# Backlog split analysis — #1073 (on-device small-VLM vision tier, Tier 2)

**Date:** 2026-06-19
**Scope:** focused split of epic [#1073](../backlog/1073-on-device-small-vlm-vision-tier-tier-2-richer-critique-taggi.md) (`workItem: epic`, unsliced, `size: 13`).
**Architecture ref:** [we:docs/agent/vision-tiers.md](../docs/agent/vision-tiers.md) · ruling [#488](../backlog/488-on-device-ui-screenshot-vision-model-as-a-plateau-capability.md).

## Verdict: splits cleanly into 4 slices (3 ready now + 1 gated)

The build has four real seams — **contract → model/eval → in-browser provider → dev-browser surface** —
that mirror the Tier-1 chain (#511/#512/#514) and the existing vision seam shape. Three are independently
deliverable and agent-ready now; the fourth is a real slice but gated on the dev-browser shell existing.

### Could split

| Slice | Title | Size | blockedBy | Independent / demoable state |
|---|---|---|---|---|
| **A** | Tier-2 rich-output contract + provider-seam extension | 3 | — | Pure: a normalized rich-output envelope (description/tags/regions) + a normalizer + the `manual` null path on `registerVisionProvider`, fixture-tested like the verdict/codification halves in `we:scripts/design-refs/vision.mjs`. No model, no browser. **Demo:** unit tests green. |
| **B** | Small-VLM candidate selection + offline eval harness | 3 | — | Pick a candidate (SmolVLM/Moondream/Florence-2) and an **offline eval** scoring it on the *objective* capabilities (tagging / element-region detection) against a held-out set. **Demo:** a dated eval report ranking candidates. *(Soft dep on #1034 — see note.)* |
| **C** | In-browser Transformers JS + WebGPU provider | 3 | A, B | Wrap slice B's chosen model behind slice A's contract, running via ONNX Runtime Web / Transformers JS + WebGPU — the Tier-2 analogue of #514. **Demo:** a standalone demo page running the VLM in-browser on a screenshot. |
| **D** | Dev-browser opt-in surface (download + invoke + render results) | 3 | C, *dev-browser shell* | The opt-in download + UI that surfaces the rich output inside the dev browser (#141). **Demo:** the tier visible/usable in the dev-browser shell. |
| **E** | Per-screenshot review / tag / train UI | 3 | A | A human-in-the-loop, per-screenshot labeling surface — review the model's output on one screenshot, tag ground-truth element-regions on it, feed training. The Tier-2 analogue of #1036; produces the corpus B evals against. **Demo:** tag a screenshot, persist a labeled pair. |

**DAG:**
```
A (contract) ─┬─▶ C (in-browser provider) ─▶ D (dev-browser surface)
              │                               ▲
              │                     gated on: dev-browser shell (#141 build)
B (model/eval)┘
A (contract) ────▶ E (per-screenshot review/tag/train UI)
```

**Why this is safe (rubric pass):**
- **Size = volume, not a decision.** The *capability tier* decision is already ruled (#488); these slices
  are build volume. The one residual decision (critique-quality metric) is carved out of B — see note.
- **≥2 nameable slices, each a real home.** A/C live behind the existing `registerVisionProvider` seam
  (`we:scripts/design-refs/vision.mjs`); B is a script + eval report; D is a dev-browser surface.
- **Each ≤3.** All four land `size: 3`.
- **Clean DAG / incremental.** A and B are fully independent and startable immediately; C composes them;
  D composes C. Every edge is real (C genuinely needs both a contract and a chosen model).
- **Every slice leaves a demoable state** (tests → eval report → standalone demo → dev-browser surface),
  honoring demo-first iteration.

### Could not (fully) split — the gated remainder

- **Slice D is filable but not agent-ready now** — its valid landing state ("the tier usable in the dev
  browser") requires the **dev-browser shell to exist**. #141 ruled the dev browser (decision, resolved)
  but the *build* is staged successor work with no current build item. **Unblock action:** file/advance
  the dev-browser shell build, then D is ready. Until then C's standalone demo is the demoable home. I'll
  file D with a `blockedBy` placeholder note rather than a false-green edge.

## Note — slice B's soft dependency on the critique rubric (#1034)

Tier 2's headline use is *design critique*, but critique quality has **no clean metric** (unlike Tier 1's
verdict-agreement). Defining "good critique" is exactly the open [#1034](../backlog/1034-design-critique-rubric-what-a-page-review-measures-and-how-w.md)
rubric decision. So B is **scoped to the objectively-measurable capabilities** (tagging, element/region
detection) which need no rubric; the **critique-quality benchmark folds in once #1034 lands**. This keeps
B free of an unresolved decision (rubric-safe) while still letting you start model selection now.

## Proposed mutation (on "go")

1. #1073 stays `workItem: epic`, **drop its `size`** (storied epic; children carry the volume).
2. Scaffold A, B, C, D as `parent: 1073`, `size: 3`, with edges: C `blockedBy: [A,B]`; D `blockedBy: [C]`
   plus a body note that D is also gated on the dev-browser shell build.
3. `npm run check:standards` must stay green.
