---
kind: story
status: resolved
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "webresources semantic — paged-media-export (rules/Block, protocol deferred per #project-protocol-bar)"
relatedProject: webresources
tags: [deck, export, paged-media, pdf, webresources]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Paged-media export — separate un-scaled one-slide-per-page layout

A **separate, un-scaled paged-media layout path** (`@page` + `break-after`, all fragments materialized, notes pages) rather than printing the live scaled runtime — the reason every framework special-cases PDF. Ship as rules/Block now; extract a protocol only once a second impl exists (statute #project-protocol-bar). Homed in **webresources**. *New contract.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Added semantic `paged-media export` (`we:src/_data/semantics/paged-media-export.json`): the separate un-scaled one-slide-per-page layout path (CSS `@page` + `break-after`, all fragments materialized, notes pages) — distinct from printing the live scaled runtime. Per the #project-protocol-bar statute, shipped as **rules/Block now, not a protocol** (extract a protocol only once a 2nd impl exists). Homed in webresources; composes #1181 (fragments forced visible) + #1185 (notes pages). Auto-renders in /semantics/.
