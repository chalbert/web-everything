---
kind: story
size: 3
parent: "1836"
status: resolved
locus: frontierui
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
tags: []
---

# Seed the per-plug parity manifest (FUI) with the re-audited 3-state verdicts

FUI. Seed per-plug parity manifests under fui:plugs/ with the 16 re-audited verdicts from we:reports/2026-06-27-unplugged-functional-re-audit.md, in the #1839 3-state vocab (works / works-with-caveat + mandatory note / plugged-only + residue justification naming the missing platform hook). The measured-fact home #1839 ratified; WE holds only the type schema (S5b). Foundational for S5c (serve) and S5d (drift gate).

## Progress (batch-2026-06-27)

Seeded one parity manifest per plug (e.g. `fui:plugs/webinjectors/parity.json`) across the 10 audited
domains — **17** capability verdicts (the re-audit matrix has 17 rows, not the card's approximate "16"):
**7 works · 8 works-with-caveat · 2 plugged-only**. Each `plugged-only` entry carries the residue
justification naming the missing platform hook (both are the same `createElement` transparent-interception
mechanism — `webinjectors`, `webcontexts` — already covered by
`fui:plugs/webinjectors/__tests__/unit/webinjectors.residue.test.ts`). Two caveat rows are
**not-yet-ported** (portable, not residue) — `webexpressions` interpolation (#1856) and `webvalidation`
form-fields (#1857) — marked `works-with-caveat` with a `pendingPort` pointer, since the ratified 3-state
enum (#1839) has no "not-yet-ported/absent" slot; the mandatory note carries that truth. The optional
`pendingPort` field is the seed's only schema addition beyond #1839's `state`/`note`/`residue` — formalised
as the type-only schema in #1888. `locus` set to `frontierui` (the card lacked it; the data is a measured
FUI-runtime fact per #1839/#1282).
