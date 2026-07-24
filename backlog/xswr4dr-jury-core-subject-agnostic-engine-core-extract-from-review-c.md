---
kind: story
size: 5
parent: "2649"
status: open
scope: ["we:scripts/lib/"]
dateOpened: "2026-07-24"
tags: []
---

# jury-core — subject-agnostic engine core (extract from review-core)

Lift the subject-neutral method core out of we:scripts/lib/review-core.mjs into we:scripts/lib/jury-core.mjs — finding contract, round loop + NEGOTIATION_ROUND_CAP, diversity-selection reduction, care→rigor dial. we:scripts/lib/review-core.mjs keeps re-exporting so every current caller stays byte-stable. Foundational root.
