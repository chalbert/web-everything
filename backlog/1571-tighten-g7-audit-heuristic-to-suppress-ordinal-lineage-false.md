---
kind: task
status: open
dateOpened: "2026-06-22"
tags: []
---

# Tighten G7 audit heuristic to suppress ordinal/lineage false positives

The G7 cite-the-case audit (we:scripts/audit-backlog-health.mjs, citesCodifiedCase) over-reports a tolerated residue: bare `#N` that are really ordinals (e.g. "acceptance 2", "Fix 2", an intra-card feature-list "6/9/10", "step/gap N") or deliverable-lineage cites ("CustomStorageStrategy from project 011") where citing the case, not the rule, is correct. After the #1502 sweep these recur every run as noise. Add a heuristic to citesCodifiedCase: skip a backlog-number token immediately preceded by an ordinal word (acceptance|fix|step|phase|gap|criterion|feature|idea|fork|option|Q|DC) and same-card list ordinals; leave the irreducible lineage cites documented. Low-risk audit-only change. (This card's own examples drop the leading `#` so it does not re-trip the flag it describes.)
