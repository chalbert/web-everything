---
kind: story
size: 3
parent: "1552"
status: resolved
blockedBy: ["1582", "1583"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:src/judge-eval/evalHarness.ts"
locus: plateau-app
tags: [plateau-app, trainable-judge, "1552", "1582", "1583"]
---

# Trained-vs-frozen judge eval — prove the trained judge beats the frozen one on held-out feedback

The epic's success metric (#1552): demonstrate a trained judge beats the frozen NullJudgeModel/descriptive baseline on the #1582 held-out regression benchmark. Wire the eval harness that scores both judges' OUTPUTS against ground truth (precision, severity accuracy, recall via missed-issue labels, and false-positive rate as a first-class metric), reports the delta, and gates the #1583 learning mechanism's escalation from k-NN to logistic probe. Because it scores outputs not embeddings, the same harness re-validates any judge agent after an encoder/VLM swap — the portable counterpart to the portable corpus. Per we:docs/agent/platform-decisions.md#trainable-judge.

## Progress (batch-2026-06-22-1581-1582-1576-1355-1531)

Built as **Plateau impl** (`plateau:src/judge-eval/`; #1282), composing the #1582 `scoreJudge` benchmark +
the #1583 `TrainableJudge`:

- `plateau:src/judge-eval/evalHarness.ts` — `evalJudges(trained, frozen, cases)` scores both judges'
  **OUTPUTS** on the #1582 held-out benchmark and reports the per-metric delta (recall / precision / fpRate /
  accuracy). `frozenBaselineJudge` is the canonical frozen baseline (the inert `NullJudgeModel` — the judge
  before any feedback). `proveTrainedBeatsFrozen` is the epic's portable success metric; `trainedWins` =
  strictly higher accuracy AND recall not regressed AND **fpRate within the first-class ceiling**.
  `formatEvalReport` renders the verdict + per-criterion audit for CI logs / the explorer report tier.
  Because it scores outputs, it re-validates **any** judge agent after an encoder/VLM swap.
- `plateau:src/judge-eval/evalHarness.test.ts` — 5 headless tests: the frozen baseline floor on the real
  benchmark (recall 0), a Stub-trained #1583 judge **beating** that baseline on a held-out set (recall up,
  fpRate within ceiling ⇒ `trainedWins`), a flag-everything judge correctly **not** winning (FP ceiling), and
  the delta math.

Scope: **severity accuracy** is noted-not-scored — the candidate output shape (`{detail, confidence}`)
carries no severity, so it needs a severity-carrying candidate first (recorded in the harness header).
The production vision encoder is the injected #1583 parameter — the StubEncoder demonstrates the
trained-beats-frozen metric over aligned data without a model dependency.
