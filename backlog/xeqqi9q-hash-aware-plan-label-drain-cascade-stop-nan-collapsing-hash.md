---
kind: story
size: 2
parent: "x6yoscx"
status: open
dateOpened: "2026-07-10"
tags: []
---

# Hash-aware plan-label-drain cascade (stop NaN-collapsing hash-keyed items)

Replace the Number()/.map(Number) coercions feeding the plan-label-drain path in we:scripts/merge-ai-prs.mjs with asItemId from we:scripts/readiness/lane-manifest.mjs, so hash-keyed item ids and blockedBy edges stop collapsing to a single NaN bucket. Define the ready-set sort as numeric items by number and hash items by blockedBy/stackParents topology. Pure bug fix — the cross-item blockedBy cascade is already broken for any hash-keyed item under JIT numbering. Tests: a hash blockedBy defers then frees; two distinct hashes are distinguished (not one NaN bucket).
