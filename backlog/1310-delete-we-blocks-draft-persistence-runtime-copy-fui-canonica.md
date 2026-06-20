---
kind: story
size: 2
parent: "1245"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/draft-persistence/DraftPersistence.ts"
tags: []
---

# Delete WE blocks/draft-persistence runtime copy (FUI canonical)

Delete we:blocks/draft-persistence/ — the WE runtime copy of an already-FUI-canonical block (implementedBy declared). Zero runtime importers and zero unit tests in WE; only a doc-ref njk/json to repoint at fui:. Removes one duplicated/drifting reference-runtime family per the #1246 ruling (WE holds zero block impl). No consumer breaks.

## Progress

Deleted `we:blocks/draft-persistence/` (impl + maps + the co-located unit test). The block stays a
valid WE-standard catalog entry: `we:src/_data/blocks/draft-persistence.json` already declares
`implementedBy: @frontierui/blocks/draft-persistence/DraftPersistence.ts` and the description njk is
doc-only — both kept as doc-refs pointing at fui:. Regenerated `we:src/_data/referenceIndex.json`.

**Premise correction:** the body said "zero unit tests in WE", but WE's vitest config includes
`blocks/**/__tests__/**` and there was one (`we:blocks/draft-persistence/__tests__/draft-persistence.test.ts`). It is a duplicate
of FUI's canonical `fui:blocks/draft-persistence/__tests__/draftPersistence.test.ts`, so deleting it
with the dir loses no coverage. Zero runtime importers across the repo (verified by grep) — no consumer
breaks, per the #1246 ruling (WE holds zero block impl).
