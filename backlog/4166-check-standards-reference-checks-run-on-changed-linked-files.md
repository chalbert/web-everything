---
bornAs: xdr571y
kind: story
size: 8
parent: "4163"
status: resolved
scope: ["we:scripts/check-standards.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/readiness/claimScope.mjs", "we:src/_data/backlog.js"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-26"
dateResolved: "2026-09-26"
tags: []
---

# check:standards reference checks run on changed + linked files via git grep

In --local mode, run the reference-following checks of we:scripts/check-standards.mjs on the changed files PLUS the files linked to them in both directions: unresolved-ref joins, blockedBy edges, formerSlugs, registry joins, statute/memory citations, test-only exports, declared module contracts. Incoming links (who references a changed/renamed/deleted id) are found with git grep per changed id — no maintained index; add a shared per-origin/main cached index only if git grep measures slow. blockedBy cycle detection walks out from the changed nodes only (a new cycle must cross a changed edge). Duplicate ids and the we:AGENTS.md inventory stay global but cheap (ids from filenames/git grep, not parsing all ~4.1k cards). Load only in-scope backlog cards (the 2.7s full load in we:src/_data/backlog.js). Lane-caused broken links now FAIL the lane instead of being demoted to notes. Done when the replay proof (4164) shows zero lane-own misses and before/after timings.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
