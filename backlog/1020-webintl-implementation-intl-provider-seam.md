---
type: idea
workItem: epic
parent: "1008"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webintl implementation — Intl provider seam

Implementation epic for the webintl standard (internationalization). Design lineage: #017 project promotion. Scope: an Intl.* provider seam (contract to @webeverything, provider runtime to FUI) — Intl.Collator / DateTimeFormat / NumberFormat / RelativeTimeFormat behind a swappable provider. Carved from the #1008 concept-to-built triage roadmap.

**Sliced** into the contract/provider/demo trio: #1054 (Intl provider contract → @webeverything), #1055 (Intl.* runtime → FUI, blockedBy #1054), #1056 (conformance demo, blockedBy #1054). #1055 and #1056 proceed in parallel after #1054.
