---
type: idea
workItem: story
status: resolved
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "webintents glossary semantic — slide-addressing (two-level deep-link + instant-jump restore)"
relatedProject: webintents
tags: [deck, navigation, deep-link, webintents]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Slide addressing / 2D-nav — two-level deep-link + instant-jump restore

Extend the `navigation` / `deep-link` / `route` semantics with **two-level addressing** (slide + vertical, slide + fragment, e.g. `#/3/2`) and an **instant-jump restore** mode that lands on a deep-linked slide without replaying every intervening transition (no transition storm on reload). Homed in **webintents** (navigation vocabulary). *Updated/extension.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Extended the navigation/deep-link vocabulary with semantic `slide addressing` (`we:src/_data/semantics/slide-addressing.json`): two-level deep-link (`#/3/2` = slide + vertical/fragment) + the instant-jump restore mode (land on a deep-linked address without replaying intervening View Transitions — no transition storm on reload). Composes Navigation `persistence:url` + the #1179/#1181 families. Homed in webintents per #1175; auto-renders in the /semantics/ glossary.
