---
kind: story
size: 5
parent: "1552"
status: resolved
blockedBy: ["1580"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:src/judge-benchmark/benchmark.ts"
locus: plateau-app
tags: [plateau-app, trainable-judge, "1552", "1553", "1580"]
---

# Trainable-judge regression benchmark — variant-rich bad-pattern catalogue + false-positive traps

Build the curated, held-out regression benchmark that makes the trainable judge (#1553) trustworthy: a catalogue of bad patterns with MANY variants each (reflow/theme/density/locale/animation phase) so a judge can't pass by memorizing one frame, PLUS a large negative set of deliberate false-positive traps (plausible-but-correct states it must NOT flag — FP rate is a first-class scored metric). Strictly train-disjoint (split applied at #1580 ingestion, never crossed). Scores OUTPUTS, so it validates any judge agent (the portable yardstick). CI-gated on accuracy even though the judge's output never gates an explored run (#1172). Per we:docs/agent/platform-decisions.md#trainable-judge.

## Progress (batch-2026-06-22-1581-1582-1576-1355-1531)

Built the benchmark as a **Plateau-owned** module (`plateau:src/judge-benchmark/`), behind a structural
judge port (any `JudgeModel`-shaped agent plugs in — the portable yardstick), depending only on the
WE-owned `JudgeSeverity` contract (`@webeverything/contracts/trainable-judge`, type-only; #1282 holds —
zero WE executable):

- `plateau:src/judge-benchmark/benchmark.ts` — the **variant-rich catalogue**: 8 bad-pattern families ×
  multiple variants each across the reflow/theme/density/locale/animation-phase axes (a judge can't pass by
  memorizing one frame), PLUS a **negative set of 12 false-positive traps** (plausible-but-correct states
  that superficially resemble a bad pattern but must NOT be flagged). All cases are tagged
  `split: 'benchmark'` — train-disjoint by construction (the #1580 split point, never crossed).
- `scoreJudge()` — scores **outputs only** (a judge flags iff it returns ≥1 candidate ≥ the confidence
  threshold): recall (caught / bad-patterns), **fpRate as a first-class metric** (flagged / traps),
  precision, accuracy, plus `byPattern` / `byVariant` breakdowns and the missed / false-positive case lists.
- `gateJudge()` + `BENCHMARK_ACCURACY_FLOOR` / `BENCHMARK_MAX_FP_RATE` — the **CI accuracy gate** any real
  judge is held to (the judge's run output stays advisory and never gates an explored run, #1172).
- `plateau:src/judge-benchmark/benchmark.test.ts` — headless vitest gate: catalogue well-formedness (every
  family is variant-rich across ≥2 axes; the trap set is substantial; ids unique; split-disjoint), scorer
  correctness against synthetic judges (null → 0 recall/0 FP; flag-all → 1 recall/1 FP; an oracle →
  accuracy 1; sub-threshold confidence is not a detection), and `gateJudge` discrimination.
