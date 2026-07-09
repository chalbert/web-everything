---
kind: task
status: open
dateOpened: "2026-07-09"
tags: [pr-flow, lane-pool, tooling]
---

# pr-land escalation miscomputes from a stale origin/main in lane clones

we:scripts/pr-land.mjs (via we:scripts/lint-locus-prefix.mjs) throws `Invalid revision range origin/main..<sha>` when run from a lease lane whose local origin/main ref lags the committed base, then emits bogus escalation reasons — blast-radius citing files the PR never touched, and an inflated changed-line count (e.g. size 1142 for a 4-file PR). Non-fatal: the PR opens clean and CI is the real gate, but the garbage reasons mislead review triage and needlessly force review:human. Fix: fetch origin (or read the PR's GitHub diff) before computing the escalation range. Observed twice on 2026-07-09 (PRs #286, #289).
