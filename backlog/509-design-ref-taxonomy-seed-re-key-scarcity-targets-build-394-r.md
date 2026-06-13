---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["394"]
dateOpened: "2026-06-13"
tags: [design-reference, corpus, taxonomy, classification, tooling]
---

# Design-ref taxonomy seed + re-key + scarcity targets (build #394 ruling)

## Digest

Mechanical build follow-through for the [#394](394-design-ref-corpus-first-run-scope-taxonomy-seed-grow-targets.md)
ruling (taxonomy ratified **B / C / B / A**). Add `design-refs/taxonomy.json` seeded with the
`productRegister` + ~10-domain `category` canonical lists; re-key the 16 existing `designRegister`
values to `productRegister` (no recapture); append scarcity-weighted grow-target cells to
`targets.json` and run `design-refs collect` toward ≥3 shots per thin (productRegister × category)
cell; point the `report` command at the new keyed vocab. No further design — the phase-1 pipeline
already supports the fields. Thin cells unreachable via public Playwright capture depend on #397
(gallery harvest), not this item.

## Tasks

1. **`design-refs/taxonomy.json`** — keyed open-growing registry (Fork 2 = C). Seed two vocabularies:
   - `productRegister`: `enterprise`, `modern-saas`, `consumer`, `creative-tool`, `utilitarian`.
   - `category`: ~10 coarse domains (Fork 4 = A), cross-referenced to G2/Capterra top-level names
     where they map. Cover at minimum: developer-tools, whiteboard-diagramming, code-playground,
     consumer/social, commerce/admin, finance/banking, productivity/collaboration,
     communication/inbox, content/media, analytics.
2. **Re-key (Fork 1 = B)** — migrate the 16 existing `designRegister` values in `targets.json` →
   `productRegister`; introduce `visualStyle` as a vision-pass-filled field (left empty at collect
   time). Mechanical, no recapture. Re-run `design-refs index` so sidecars/`index.json` carry the
   new keys.
3. **Scarcity grow-targets (Fork 3 = B)** — append `targets.json` entries for the thin cells
   (consumer/social, commerce/admin, finance/banking, productivity/collaboration,
   communication/inbox, content/media), aiming ≥3 shots per under-covered (productRegister ×
   category) cell, ~30–50 first run. Run `design-refs collect`. Cells unreachable via public capture
   are left for #397 — record them, don't force a marketing-splash capture.
4. **`report`** — point the aggregation at the keyed `taxonomy.json` vocab (by `productRegister` /
   `category`), validating new values against the registry (warn on unregistered).

## Acceptance

- `taxonomy.json` exists with both seeded vocabularies; `report` reads from it.
- All 16 existing targets carry `productRegister` (no `designRegister`); `visualStyle` present (may
  be null/empty).
- `targets.json` has scarcity-cell entries; a `collect` run is idempotent on re-run.
- `check:standards` green.
