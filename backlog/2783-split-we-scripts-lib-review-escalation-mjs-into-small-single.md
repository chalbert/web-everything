---
bornAs: xhnhwna
kind: story
size: 3
status: open
blockedBy: ["2678"]
scope: ["we:scripts/lib/review-escalation.mjs"]
relatedTo: ["2606", "2679"]
dateOpened: "2026-07-28"
tags: []
---

# Split we:scripts/lib/review-escalation.mjs into small single-responsibility modules (RANK 3 — 8 scope-collisions)

Split we:scripts/lib/review-escalation.mjs along its responsibility seams into small single-responsibility modules, keeping a thin re-export entrypoint. MOTIVATION (per #2678): this file is named in 8 queued items' scope: frontmatter — the 3rd-largest scope-lease lock on the board, so 8 items serialize against it under file-level leases. Splitting it lets those items declare disjoint scopes and build in PARALLEL. Rank 3 of the god-file split list (after merge-ai-prs, review-core). Verify genuine responsibility clusters exist before splitting; split ONLY along real seams — cohesion outranks line count; mark a genuinely-cohesive residual // @cohesive:. Statute: we:docs/agent/platform-decisions.md#small-file-preference.
