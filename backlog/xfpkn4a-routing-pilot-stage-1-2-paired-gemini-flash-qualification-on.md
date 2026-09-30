---
kind: story
size: 5
parent: "4673"
status: open
scope: ["we:scripts/lib/model-probation.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/lib/__tests__/model-probation-trials.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Routing pilot stage 1-2: paired Gemini Flash qualification on text work and the test-only route

Operator ruling on #4673 (option b narrowed): run the pre-registered paired qualification with Gemini Flash only — exact transforms, reader-facing corrections and supplied-data card drafts, then the existing Flash test-only route after probing its 210-LOC envelope row and its unreadable-checker row. Independent checker on every trial, all assigned tasks counted (failures, holds, fallbacks), dossier thresholds from #4673 (20 matched tasks per class, >=25% median net frontier reduction, zero critical escapes, p95 <= 1.25x). Promotion stays an explicit operator call.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
