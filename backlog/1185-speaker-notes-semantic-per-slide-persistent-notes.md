---
kind: story
status: resolved
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: webresources glossary semantic — speaker-notes (per-slide content+storage)
relatedProject: webresources
tags: [deck, speaker-notes, storage, webresources]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Speaker-notes semantic — per-slide persistent notes

Per-slide note content (text/markdown), hidden in the presentation and shown in the presenter view, with authoring + persistence. A **semantic + storage** contract homed in **webresources** (+ webstates for persistence, webcomponents for the authored element). *New contract.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Added semantic `speaker notes` (`we:src/_data/semantics/speaker-notes.json`): per-slide note content (text/markdown), hidden in the audience render, shown only in the presenter view; a content+storage contract referenced via the #1180 document-model `notes` field, composing webstates (persistence) + webcomponents (authored element). Homed in webresources per #1175; auto-renders in /semantics/.
