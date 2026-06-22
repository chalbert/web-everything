---
kind: epic
parent: "866"
status: open
relatedReport: reports/2026-06-22-backlog-split-analysis.md
dateOpened: "2026-06-22"
tags: []
---

# Migrate WE-docs catalog tiles/cards to FUI blocks/card (mode-C mount)

Umbrella for migrating the catalog tile/card surfaces (~20 pages) to FUI blocks/card via the mode-C inline
mount proven by #1598. **2nd-level slice (2026-06-22, `/slice`, see relatedReport)** — split by page-group,
each child `blockedBy #1598`:

- **#1607** — core catalog pages (`we:src/intents.njk`, `we:src/blocks.njk`, `we:src/design-systems.njk` + peers) · size 3
- **#1608** — `we:src/_includes/project-*.njk` include tiles · size 3
