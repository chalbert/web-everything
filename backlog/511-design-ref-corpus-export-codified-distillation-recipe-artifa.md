---
kind: story
size: 3
parent: "490"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Design-ref corpus export + codified distillation recipe artifact (per #488 F5)

A versioned, model-agnostic training artifact for the on-device verdict classifier: a design-refs export step that reads items/*/meta.json (visionVerdict) + quarantine/* into a {frame,verdict} training manifest with a held-out split, plus the distillation recipe (config + dated-revision log) so a base-model switch re-runs the recipe rather than re-labelling. Reads the format archiveQuarantinedFrame (#489) already materialises; fixture-tested like we:archive-quarantine.test.mjs, so it builds without real corpus data. Slice A of epic #490.

## Progress (2026-06-13) — resolved

Delivered both halves against the format #489 already materialises — no real corpus data needed:

- **The recipe artifact** — new [we:design-refs/distillation-recipe.json](../design-refs/distillation-recipe.json): versioned, model-agnostic config (6-verdict label space, ≲10 MB MobileNet/ViT student, task-specific KD from the cached hosted-model verdicts, preprocess, `holdoutFraction`, graduation benchmark) + a dated `revisions` log. A base-model switch bumps `version`, appends a revision, and **re-runs `export`** — never re-labels (the labels are the corpus's `visionVerdict`s). No teacher/provider name in the recipe (no-leakage, #475).
- **The export step** — `we:design-refs.mjs export` (+ pure `buildTrainingManifest` / `assignSplit`): reads admitted `items/*/meta.json` + `quarantine/*/meta.json` into one `{frame, verdict}` manifest with a **deterministic, content-addressed held-out split** (a frame's split is a pure function of its `contentHash`, so it never migrates train↔holdout as the corpus grows and re-runs diff cleanly). The label IS the model verdict — ungated shots (no `visionVerdict`) are excluded and counted `unlabeled`, never inferred. Stamps the manifest with the recipe version + revision log.
- **Fixture test** — [we:export-corpus.test.mjs](../scripts/design-refs/__tests__/export-corpus.test.mjs) (7 tests, green): split determinism + extremes, label-is-verdict, unlabeled exclusion, sorted/diff-clean records, empty-corpus validity.

`check:standards` green (0 errors). Smoke `export` on the live corpus: 16 admitted shots, all ungated → 0 labeled / 16 unlabeled (honest — no vision provider has run yet; the manifest fills as `collect`/`harvest` accumulate gated frames). Unblocks epic #490 slice B (benchmark harness reads this manifest's held-out split).
