---
type: idea
workItem: story
status: open
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
relatedProject: webintents
tags: [deck, navigation, deep-link, webintents]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Slide addressing / 2D-nav — two-level deep-link + instant-jump restore

Extend the `navigation` / `deep-link` / `route` semantics with **two-level addressing** (slide + vertical, slide + fragment, e.g. `#/3/2`) and an **instant-jump restore** mode that lands on a deep-linked slide without replaying every intervening transition (no transition storm on reload). Homed in **webintents** (navigation vocabulary). *Updated/extension.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*
