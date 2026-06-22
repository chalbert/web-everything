---
kind: story
size: 5
status: resolved
blockedBy: ["1505"]
dateOpened: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:scripts/backlog/capacity.mjs"
tags: []
---

# Implement the pooled affine context-cost estimator in the batch calibrator

Replace the single-ratio capacity estimate (points/fraction, line through origin) with a pooled affine fit context% = overhead + cost*points over ALL stored samples in we:.claude/skills/batch-backlog-items/capacity.json (drop the work-bound exclusion gate in we:scripts/backlog/capacity.mjs so every batch trains both params); fit via Deming/errors-in-variables; derive the next-batch budget by solving overhead + cost*P <= context-ceiling with a data-driven margin (lower-CI capacity / shrinkage toward median), replacing the arbitrary x0.6. Bootstraps immediately from existing history (raw tuples already stored). Ratified in #1505.
