---
kind: story
status: resolved
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "protocol:analytics-vocabulary"
relatedProject: webanalytics
tags: [deck, analytics, webanalytics]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Deck analytics vocabulary — slide impressions / dwell / drop-off

Extend the `analytics-vocabulary` protocol with deck events — slide impressions, dwell time, drop-off, interaction — greenfield in every open framework. Homed in **webanalytics**. *Updated/extension.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Extended the `analytics-vocabulary` protocol with a deck event vocabulary (`we:src/_data/protocols/analytics-vocabulary.json` summary + a "Deck Event Extension" subsection in `we:src/_includes/project-webanalytics.njk`): Slide Viewed (impression), Slide Dwell, Deck Completed/Abandoned (drop-off), Slide Interaction — each a Segment verb-noun `track` event keyed by a #1180 document-model slide address. Adds vocabulary, not a new transport. Homed in webanalytics per #1175.
