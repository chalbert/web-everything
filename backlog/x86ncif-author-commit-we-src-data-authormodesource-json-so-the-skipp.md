---
kind: story
size: 2
status: open
dateOpened: "2026-07-28"
tags: [maas, authoring, testing]
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
