---
kind: task
parent: "2405"
relatedTo: ["3007"]
status: open
scope: ["we:scripts/pr-land.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/review-ledger-check.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# three hold-label writers bypass the verdict ledger, leaving PRs with no row

Found by an Opus design review 2026-09-23 of #3007 Phase 2 readiness. The drain's own main park path has written the ledger since 2026-09-08 (#3215), but three OTHER hold-label writers do not: (1) we:scripts/pr-land.mjs:921 applies review:human at PR-open time with no ledger write, (2) we:scripts/merge-ai-prs.mjs:4064 re-parks to review:human when the PR's manifest changed after review, with no ledger write, (3) we:scripts/merge-ai-prs.mjs:4115 re-parks to review:human when tests look tampered with, also no ledger write. Confirmed live: PR #2486 and #2492 both carry review:human with zero matching ledger rows, both labelled via we:scripts/pr-land.mjs at open. A ledger-only merge gate (the eventual #3007 flip) would merge straight past any of these three holds -- the exact hold-that-did-not-hold failure class #2750/#2820/#2745/#2416 already exist to prevent. Fix: write a ledger row (recordDrainVerdict or equivalent) at each of the three call sites, and back-fill a row when a PR already carries a hold label but the ledger has none for it. Also fix we:scripts/review-ledger-check.mjs's own 'OWED BEFORE PHASE 2' message, which still blames we:scripts/merge-ai-prs.mjs's applyLabel -- that diagnosis is stale since #3215 landed.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
