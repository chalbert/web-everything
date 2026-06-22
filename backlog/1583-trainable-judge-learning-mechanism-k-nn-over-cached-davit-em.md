---
kind: story
size: 8
parent: "1552"
status: resolved
blockedBy: ["1581"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:src/judge-learning/judgeRecipe.ts"
locus: plateau-app
tags: [plateau-app, trainable-judge, "1552", "1553", "1581", "1582"]
---

# Trainable-judge learning mechanism — k-NN over cached DaViT embeddings, eval-gated logistic-probe escalation

Implement the v1 learning mechanism behind the JudgeModel seam (#1553 Fork 2): k-NN retrieval over cached DaViT vision-encoder embeddings (free off the already-loaded Florence-2 encoder; on-device; works from the FIRST label / cold-start), voting nearest labeled states. Escalate to a linear/logistic probe on the SAME embedding cache at ~tens of labels, eval-gated by #1582. k-NN→probe share the whole pipeline, so v1 is not throwaway. The recipe is encoder-parameterized (embed→k-NN→probe), authored model-agnostically so it ports to any judge agent; probe weights are model-specific but disposable. Full VLM fine-tune stays parked (server-side, >~1k labels). Per we:docs/agent/platform-decisions.md#trainable-judge.

## Progress (batch-2026-06-22-1581-1582-1576-1355-1531)

Built as **Plateau impl** (`plateau:src/judge-learning/`; #1282 — WE holds zero executable), over the #1581
corpus store + the #1580 contract (type-only) and scored by the #1582 benchmark:

- `plateau:src/judge-learning/encoder.ts` — the **`VisionEncoder` seam** (`embed(frame) → vector`, `id` =
  the `(encoderId, frameHash)` cache-key half so a swap invalidates the cache cleanly). The recipe is
  **encoder-parameterized** (the model-agnostic part). `StubEncoder` is a deterministic, dependency-free
  feature-hashing stand-in for cold-start/dev/test (the #475 stand-in→repoint pattern); the production
  DaViT/Florence-2 encoder implements the same seam.
- `plateau:src/judge-learning/judgeRecipe.ts` — `embed → k-NN → probe`: `buildLabeledIndex` (train-disjoint;
  reads the corpus asset, derives+**caches** embeddings — a re-derivable cache, never the asset, so an
  encoder swap re-embeds with **zero data loss**), similarity-weighted `knnVote` (cold-start, works from the
  first label), `LogisticProbe` (L2-regularized logistic regression on the SAME cache), and `TrainableJudge`
  (a `JudgeModel`/`BenchmarkJudge`-shaped agent). `chooseMechanism` is the **#1582-eval-gated escalation**:
  k-NN until ≥ `MIN_PROBE_LABELS` (~tens) AND the probe's held-out benchmark accuracy ≥ k-NN's. The judge
  output stays advisory and never gates an explored run (#1172).
- `plateau:src/judge-learning/judgeRecipe.test.ts` — 14 headless tests over a real fs-backed corpus store:
  embedding geometry, k-NN voting, the probe learning a separable set, train-disjoint index build, the
  re-derivable-cache / zero-data-loss encoder swap, the cold-start judge, and the escalation gate
  (cold-start → k-NN; enough labels + probe ≥ k-NN → probe).

Note: the production vision encoder (DaViT/Florence-2) is the **injected parameter** — out of this slice by
design (#1553 ruling 3); the `StubEncoder` proves the recipe end-to-end without a model dependency.
