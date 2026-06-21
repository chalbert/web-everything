---
kind: task
parent: "1327"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: scripts/check-standards.mjs
tags: []
---

# Scoped glossary coverage gate + isConcept honoring in we:scripts/check-standards.mjs

Slice B of #1327 (scope ratified in #1343). Add a coverage rule beside §5 semantics-hygiene at we:scripts/check-standards.mjs:248: build a normalized glossary term-set, iterate the in-scope source registries (intents + protocols + capabilities) and WARN on any entry with no matching term; additionally require a term for any we:src/_data/blocks/ or we:src/_data/plugs/ entry flagged isConcept: true. Warn-level (matches existing coverage warnings) so it lands first without breaking the gate — surfaces the ~75 gap that A1/A2 then clear. Honoring the isConcept flag is the mechanism #1368 (slice C) consumes.

## Progress (batch-2026-06-20-1372-1369)

Done. Added **§ 5a — Semantics glossary COVERAGE** to `we:scripts/check-standards.mjs` right after the
existing §5 hygiene block. A `conceptKey()` normalizer (drops a trailing `Intent|Protocol|Plug|Capability|Block`
suffix word, lowercases — mirrors the #1327 audit join so `"Action Intent"` ↦ term `"Action"`) builds a
`termSet` from `semantics`, then:
- iterates **intents + protocols + capabilities** wholesale and WARNs on any entry whose name (capabilities:
  `label`) has no matching term;
- honors the per-item `isConcept: true` opt-in on **blocks + plugs** (no entries carry it yet — #1368 adds
  them — so currently a no-op, the mechanism slice C consumes).

All **warn-level**; gate stays green (`0 error(s)`). Fires **95** coverage warnings: 46 intents + 29
protocols (the expected ~75 that A1 #1369 / A2 #1370 clear) **+ 20 capabilities**.

**Grounding correction surfaced:** #1343 ratified capabilities as "already 0-gap (21/21), folded in at no
cost" — that premise is **wrong**. Only **1/21** capability labels (`Declarative Shadow DOM`) matches a
term; ~20 are genuinely missing (Popover API, Dialog, Anchor Positioning, contentEditable, Sanitizer API,
…). The scope *decision* (capabilities in the required wholesale set) stands, so the gate correctly includes
them; the missing-term backfill (the cost #1343 mis-estimated as zero) is filed as **A3 → #1380** so the
capability warnings have a remediation home. No fork — the gate is warn-level and works as specified.
