---
kind: task
parent: "1585"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:src/_data/designKnowledgeWatch.json"
tags: []
---

# Design-knowledge corpus ledger + front-A conformance metric

L0→L1 front-A conformance slice of the design-knowledge intake program (#1585), mirroring #1267 for the platform-standards watch #1257. Build the corpus ledger we:src/_data/designKnowledgeWatch.json and a front-A metric counting curated sources not yet distilled into the rubric, wired as a gate nudge. Independent root slice — ships before any criteria land (weights provisional), the same way #1267 shipped registered:false rows.

Detail: the ledger holds one row per admitted source `{ id, source, kind (peer-reviewed/standard/guideline/book/blog), credibilityWeight, distilledInto, trackingItem }`, seeded with the obvious authoritative set (Nielsen heuristics, Apple HIG, W3C/APG, UICrit/UIST'24) at provisional equal weight pending the #1588 admission/credibility-weight decision. Add `computeDesignKnowledgeConformance()` to we:scripts/check-standards-rules.mjs → `{ total, distilled, pending, pendingList }`, wire it as a NUDGE (not error) into we:scripts/check-standards.mjs, and stamp the program's first review-log run in the #1585 epic body.

## Progress

- **2026-06-22 — done.** Built `we:src/_data/designKnowledgeWatch.json` (4 seed rows: nielsen-heuristics, apple-hig, w3c-apg, uicrit-uist24; provisional `credibilityWeight: 1.0` pending #1588; all `distilledInto: null` → 4/4 pending, tracked by #1589). Added `computeDesignKnowledgeConformance(watch)` to `we:scripts/check-standards-rules.mjs` (`{ total, distilled, pending, pendingList }`, mirrors `computeNativeFirstConformance`). Wired it as a NUDGE into `we:scripts/check-standards.mjs` (degrade-on-missing-ledger try/catch, same as #1267). Stamped the first review-log run in the #1585 epic body. Gate green.
