---
kind: epic
parent: "866"
status: open
relatedReport: reports/2026-06-22-backlog-split-analysis.md
dateOpened: "2026-06-22"
tags: []
---

# Migrate WE-docs catalog tiles/cards to FUI blocks/card (transient-CE mount)

Umbrella for migrating the catalog tile/card surfaces (~20 pages) to FUI blocks/card via the
**transient-CE mount** (`<we-card>`, #1621 rule-7 model — the card counterpart to the #1598/#1758 badge
dogfood; the original "mode-C inline mount proven by #1598" framing was **stale**, #1598 was the badge
migration that #1621 pivoted off mode-C). **2nd-level slice (2026-06-22, `/slice`, see relatedReport)** —
split by page-group, each child `blockedBy #1786` (the FUI `fui:embed/card-in-document.ts` embed entry,
re-pointed from the retired #1598, batch-2026-06-26):

- **#1607** — core catalog pages (`we:src/intents.njk`, `we:src/blocks.njk`, `we:src/design-systems.njk` + peers) · size 3
- **#1608** — `we:src/_includes/project-*.njk` include tiles · size 3
