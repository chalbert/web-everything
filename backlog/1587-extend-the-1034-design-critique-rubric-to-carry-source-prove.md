---
kind: task
parent: "1585"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:docs/agent/vision-tiers.md#design-critique-rubric-ratified-1034"
tags: []
---

# Extend the #1034 design-critique rubric to carry source provenance

L0→L1 slice of the design-knowledge intake program (#1585): extend the ratified #1034 design-critique rubric to carry provenance. The rubric (we:docs/agent/vision-tiers.md §Design-critique rubric) is already config + versioned (#1034 Fork 3's deliberate version-bump escape hatch), so this is additive: add a provenance field to each of the 8 closed axes (and the open-findings contract) linking to admitted-source ids, populated from each axis's already-named grounding, then version-bump the rubric. AI over a contract — codified heuristics carry their authoritative basis, never raw text. Schema-only: independent of the admission/credibility-weight decision and of the corpus-ledger slice. Demoable — each axis shows its authoritative provenance.

## Progress

- **2026-06-22 — done.** Bumped the #1034 design-critique rubric to **`v2`** in `we:docs/agent/vision-tiers.md` (additive, same 8 axes). Added a **Provenance** column mapping each axis to admitted-source ids from the #1586 ledger (`w3c-apg` · `apple-hig` · `nielsen-heuristics` · `uicrit-uist24`), populated from each axis's already-named grounding, and documented the open-findings contract's provenance (Nielsen 0–4 severity → `nielsen-heuristics`; closed-axes+localized-findings shape → `uicrit-uist24`). Schema-only: did **not** touch the ledger — `v2` carries the citation, the weighted distillation (flipping `distilledInto`) is #1589 post-#1588. Gate green.
