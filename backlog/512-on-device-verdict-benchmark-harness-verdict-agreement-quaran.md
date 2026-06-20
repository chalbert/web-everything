---
kind: story
size: 3
parent: "490"
status: resolved
blockedBy: ["511"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# On-device verdict benchmark harness — verdict-agreement + quarantine-recall (per #488 F1/F4)

A provider-agnostic benchmark suite that runs any registered vision provider (we:scripts/design-refs/vision.mjs classifyCandidate) over a held-out labeled slice and reports verdict-agreement % + per-class quarantine-recall against the graduation thresholds (e.g. >=95% agreement) that promote the API bridge (#485) to the bundled on-device default. Demoable against the anthropic/manual provider on a fixture corpus, so it has value measuring the hosted provider before any on-device model exists. Consumes slice A's (#511) held-out manifest format. Slice B of epic #490.

## Progress (resolved 2026-06-14)

Delivered the harness + finalized the recipe's TBD floor — fixture-tested, no real corpus data needed:

- **The scorer** — new [we:scripts/design-refs/benchmark.mjs](../scripts/design-refs/benchmark.mjs): a pure
  `scoreBenchmark({records, predictions, recipe})` over the manifest's `split:'holdout'` records →
  **verdict-agreement** (predicted == labeled) + **per-class quarantine-recall** (of frames whose TRUE
  verdict is a quarantine-class — `decideAdmission → quarantine`: marketing/error/blank/non-app — the
  fraction the provider ALSO routes to quarantine, scored by admission *decision* not exact-verdict match,
  so a wrong-but-still-quarantined verdict still counts as recalled). Gates each metric against the recipe
  floors (`parseThreshold` extracts the number; a TBD/unset floor yields a non-graduating `null` gate). A
  missing prediction is a miss, never silently dropped. No-leakage (#475): names no vendor.
- **The runner + CLI** — `runBenchmark({provider, records, recipe, loadFrame})` drives the resolved provider
  over each held-out frame (base64 WebP), then `we:design-refs.mjs benchmark` prints agreement + per-class
  recall + the graduation verdict. Default `manual` provider → all `ungated` → scores 0 vs real labels
  (honest); a real `DESIGN_REFS_VISION_PROVIDER` measures the hosted model before any on-device student exists.
- **Recipe floor finalized** — [we:distillation-recipe.json](../design-refs/distillation-recipe.json) v2:
  set the slice-A-deferred `quarantineRecallFloor` to **>=0.98** (higher than the 0.95 agreement floor —
  a quarantine miss admits junk into the corpus, an asymmetric/costlier error), with the metric definition
  + a dated revision. Thresholds-only change (no re-train/re-label trigger).
- **Tests** — [we:benchmark.test.mjs](../scripts/design-refs/__tests__/benchmark.test.mjs) (13, green): split
  filtering, perfect-pass, decision-vs-verdict recall, the costly quarantine-miss fail, unpredicted-as-miss,
  unset-floor non-graduation, empty split, + runner (provider drive / unloadable-frame skip / bad-provider throw).

Gate: `check:standards` 0 errors; full design-refs suite 69/69 green. Live smoke (`benchmark`, manual
provider): 0 held-out frames — corpus is still all-ungated, the honest pre-vision baseline. Slice B of epic
#490 complete; the harness fills as `collect`/`harvest` accumulate gated frames.
