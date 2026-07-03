---
kind: story
size: 5
status: resolved
blockedBy: ["2132"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
graduatedTo: "we:scripts/check-standards-rules.mjs"
tags: []
---

# Derived advisory tier cross-check: build the domain-to-project evidence join

Future enhancement demoted from #2088 Fork 3: a warn-only cross-check flagging an exploratory project whose domain shows benchmark demand. Blocked in substance on an evidence join that does not exist - we:src/_data/benchmarkCoverage.json is capability-to-entity keyed with no domain-to-project edge (projects list no intents/blocks, only protocols carry ownedByProject) - so this story is mostly building that join. Advisory only: it never owns the tier value (stamped per #2088).
