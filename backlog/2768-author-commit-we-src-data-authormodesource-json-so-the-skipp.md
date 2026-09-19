---
bornAs: x86ncif
kind: story
size: 2
status: open
dateOpened: "2026-07-28"
dateStarted: "2026-09-07"
tags: [maas, authoring, testing]
scope:
  - we:src/_data/
  - we:blocks/renderers/
  - fui:tools/maas/
  - fui:vitest.config.ts
scopeRationale: >-
  Dropped the bare we:scripts/ entry (2026-09-07 audit): it was a repo-wide top-level prefix matching the
  entire scripts tree (conveyor/readiness/operations machinery included), holding 32-38 unrelated queued
  items on scope overlap for an item that never touches we:scripts/ at all. Investigation (git history of
  8ac77a8e/f0ee0584) shows the ONE file that entry could ever have stood for was
  we:scripts/gen-author-mode-source.mjs, the generator that emitted we:src/_data/authorModeSource.json —
  deleted under the ratified #1282/#1730 "WE holds zero executable" rule and never coming back to WE. Per
  this card's own 2026-09-06 correction, the two live directions forward (point the skipped
  functionalAuthoringForm describes at fui:workbench/authorModeData.ts, or generate the fixture at test
  time) are both FUI-resident and touch no file under we:scripts/. we:src/_data/ and we:blocks/renderers/
  are left as-is (already specific enough, not the reported footgun).
---

# Author + commit we:src/_data/authorModeSource.json so the skipped maas authoring tests run

Author + commit `we:src/_data/authorModeSource.json` (and the webtheme vector source it needs —
`we:conformance-vectors/surfaceVectors.ts`) so the two currently-`describe.skip`ped maas
`functionalAuthoringForm` describes (`fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs:25,49`, plus the
`fui:vitest.config.ts` exclude) run for real under the `test` check. They are skipped today only because the
artifact was never committed to WE — it is ENOENT in every environment, sibling checkout or not — so authoring
and committing it un-skips both describes.

Relates #2315 (the ratified repo↔drain check contract — the `test` check certifies ~386 files today, with only
these two describes honestly skipped) and the maas authoring-form work (#1602 / #1619).

## Correction (2026-09-06) — the stated premise is false, and the proposed action violates #1282

This card says the artifact "was never committed to WE — it is ENOENT in every environment". Verified
against git during the 2026-09-06 resolved-card sweep, that is wrong on both halves:

- `we:src/_data/authorModeSource.json` **was** committed, by `8ac77a8e` (2026-06-22, a 437-line JSON,
  landed under #818).
- It was then **deliberately deleted** by `f0ee0584` (#1730, 2026-06-26) under the ratified
  "WE holds zero executable" rule (#1282 / #1771) — a month *before* this card was opened.
- Generation was re-homed in FUI as `frontierui:workbench/authorModeData.ts` (#1618 / #1865).

So authoring and committing it back into WE, as this card asks, would **re-violate #1282**. The ask
needs re-aiming before it is built: either point the two skipped `functionalAuthoringForm` describes at
the FUI-resident `frontierui:workbench/authorModeData.ts`, or generate the fixture at test time. That is a design call, so
it is recorded here rather than applied. Found by the 2026-09-06 open-story staleness audit
(`we:reports/2026-09-06-open-story-staleness-audit.md`).
