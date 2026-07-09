---
kind: story
size: 3
parent: "2208"
status: resolved
locus: plateau-app
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "plateau:src/branding-eval/journeyEvalHarness.ts — reviewer-agreement metric (per-fork outcome agreement + rationale-cites-rubric) vs the 67 logged branding-journey verdicts, plus stock-AI baseline"
tags: []
---

# Eval harness — reviewer-agreement metric vs the branding journey labels

Build the #2207 eval harness: run the design-AI reviewer over plateau:branding-proposals and score agreement vs the 67 logged user verdicts in plateau:branding-proposals/journey.json, plus a stock-AI baseline. The 'define the metric first' foundational step before any reviewer training/grounding work (residual #2207). Buildable now — labels already exist.

## Shipped

`plateau:src/branding-eval/journeyEvalHarness.ts` (+ `plateau:src/branding-eval/journeyEvalHarness.test.ts`,
16 tests). Loads and flattens the real `plateau:branding-proposals/journey.json` fixture to 67 labeled
nodes (`JourneyLabel[]`), classifies each verdict's free text into a tested 3-way outcome taxonomy
(`endorsed` / `rejected` / `inconclusive` — `classifyVerdict`), and defines the agreement metric:
`evalReviewer` scores any `JourneyReviewer` (a `{project, label, assetRef} → {outcome, rationale}` port,
mirroring the sibling `plateau:src/judge-eval/evalHarness.ts` shape) for overall agreement, decisive
(endorsed/rejected-only) agreement, a per-fork (fui/we/plateau) breakdown, and a rationale-cites-rubric
rate against `RUBRIC_ATTRIBUTE_TERMS` (a keyword proxy drawn from #2207's own learning-log vocabulary —
provisional until #2209 ratifies the formal rubric, noted in the file header as #2207's residual to swap
in). `stockAiBaselineReviewer` is the ungrounded floor; `compareToBaseline`/`formatJourneyEvalReport`
report the delta and win/no-win call. #2207 (blocked on this + #2209) plugs a real trained reviewer into
`JourneyReviewer` next.
