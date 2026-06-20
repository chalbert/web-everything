---
type: idea
workItem: story
status: resolved
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "protocol:deck-document-model"
relatedProject: webcomponents
tags: [deck, document-model, schema, webcomponents]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Slide/deck document model — interchange schema for what a slide & deck carry

Define what a **slide** and a **deck** carry at the contract level — deck > sections > slides; per-slide id, title, notes ref, fragments, layout ref, background. A content/interchange **semantic schema** (NOT a runtime engine), homed in **webcomponents** (+ webexpressions for slot/section content) per the ratified distributed placement (#1175). This is the load-bearing data model every other deck slice references. *New contract.* **Residual (per #1175):** weakest existing kin — revisit home only if a genuine deck-specific provider seam later emerges (that, not this schema, would justify minting webdecks).

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored as protocol `deck-document-model` (interchange schema, NOT a runtime engine) homed in **webcomponents** per #1175:
- `we:src/_data/protocols/deck-document-model.json` — the contract entry (deck > sections > slides; per-slide id/title/notes/fragments/layout/background; composes webexpressions for slot content; redefines none of the referenced schemas).
- `we:src/_includes/project-webcomponents.njk` — spec section `#protocol-deck-document-model` (field table + composition + boundary), satisfying the protocol-anchor gate.

The load-bearing model every other deck slice (#1181/#1182/#1185/#1187/#1190/#1191 …) keys off. Residual per #1175: weakest existing kin — revisit home only if a deck-specific provider seam later emerges.
