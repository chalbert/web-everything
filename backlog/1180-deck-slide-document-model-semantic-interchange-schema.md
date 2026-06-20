---
type: idea
workItem: story
status: open
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
relatedProject: webcomponents
tags: [deck, document-model, schema, webcomponents]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Slide/deck document model — interchange schema for what a slide & deck carry

Define what a **slide** and a **deck** carry at the contract level — deck > sections > slides; per-slide id, title, notes ref, fragments, layout ref, background. A content/interchange **semantic schema** (NOT a runtime engine), homed in **webcomponents** (+ webexpressions for slot/section content) per the ratified distributed placement (#1175). This is the load-bearing data model every other deck slice references. *New contract.* **Residual (per #1175):** weakest existing kin — revisit home only if a genuine deck-specific provider seam later emerges (that, not this schema, would justify minting webdecks).

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*
