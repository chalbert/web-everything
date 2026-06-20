---
kind: story
status: resolved
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "block:code-view"
relatedProject: webdocs
tags: [deck, code, magic-move, webdocs]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Code-presentation step-through — line-focus + magic-move

Extend the [we:code-view block](../src/_data/blocks/code-view.json) with **line-focus** and token-level **magic-move** (a domain-specific View Transition over code spans). Homed in **webdocs** (code-view's project). *Updated/extension.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Extended the `code-view` block (`we:src/_data/blocks/code-view.json`) for code presentation: summary + `webStandards.viewTransitions` (token-level magic-move via `view-transition-name` on stable token identities) + `designDecisions.codeStepThrough` (line-focus = a stepped emphasis Highlight range; magic-move = a View Transition over code spans) — both ride the same CSS Custom Highlight ranges the highlighter already paints. Honors prefers-reduced-motion (#1183/#1195); composes the #1191 code layout template. Homed in webdocs per #1175.
