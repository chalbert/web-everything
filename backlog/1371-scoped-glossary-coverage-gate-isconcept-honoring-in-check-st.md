---
kind: task
parent: "1327"
status: open
dateOpened: "2026-06-21"
tags: []
---

# Scoped glossary coverage gate + isConcept honoring in we:scripts/check-standards.mjs

Slice B of #1327 (scope ratified in #1343). Add a coverage rule beside §5 semantics-hygiene at we:scripts/check-standards.mjs:248: build a normalized glossary term-set, iterate the in-scope source registries (intents + protocols + capabilities) and WARN on any entry with no matching term; additionally require a term for any we:src/_data/blocks/ or we:src/_data/plugs/ entry flagged isConcept: true. Warn-level (matches existing coverage warnings) so it lands first without breaking the gate — surfaces the ~75 gap that A1/A2 then clear. Honoring the isConcept flag is the mechanism #1368 (slice C) consumes.
