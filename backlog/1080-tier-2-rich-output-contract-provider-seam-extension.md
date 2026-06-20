---
kind: story
size: 3
parent: "1073"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:scripts/design-refs/vision.mjs"
tags: []
---

# Tier-2 rich-output contract + provider-seam extension

The foundation slice (A) of #1073: a normalized rich-output envelope (description / tags / element-regions) on the existing registerVisionProvider seam (we:scripts/design-refs/vision.mjs), mirroring how that file normalizes the verdict + codification halves — a new method + normalizer + the manual null-provider path, fixture-tested without a model or browser. No-leakage holds (only outputs cross). Independent, startable now; demoable as green unit tests. Unblocks slice C (#1073 in-browser provider).

## Progress (2026-06-19) — resolved

The third method on the shared vision client, alongside `classifyCandidate` (verdict) and
`analyzeForCodification` (facets) — the Tier-2 rich envelope a small VLM produces but a classifier can't.

- **Contract** — added to [we:scripts/design-refs/vision.mjs](../scripts/design-refs/vision.mjs):
  `normalizeRichOutput(raw)` → `{ description, tags, regions, ungated }` where a region is
  `{ label, box }` and `box` is an OPTIONAL normalized bounding box `{ x, y, w, h }` in 0..1 (null when
  the model gave a label but no localization). Defensive like the verdict/codification halves:
  description trimmed-or-null, tags deduped/trimmed/filtered, regions drop label-less entries and null a
  partial/non-numeric/out-of-range box (clamped to 0..1).
- **Seam** — `analyzeRich(provider, input)` calls `provider.analyzeRich` if present, else returns the
  `ungated` envelope stamped with the provider name (same no-op-offline guarantee as
  `analyzeForCodification`); the built-in `manual` null provider gains an `analyzeRich` returning
  `{ ungated: true }`. No-leakage holds — only outputs cross, the seam stays vendor-free.
- **Tests** — [we:scripts/design-refs/__tests__/rich-output.test.mjs](../scripts/design-refs/__tests__/rich-output.test.mjs)
  (12 tests, green): normalizer extremes (clamp / partial box / label-less drop / dedup / ungated
  sentinel) + the swap point (no-method fallback, real mock provider, manual null path). Full suite
  28/28; `check:standards` 0 errors.

Slice C (#1082) now wraps a chosen model behind this envelope; slice E (#1084) tags against it.
