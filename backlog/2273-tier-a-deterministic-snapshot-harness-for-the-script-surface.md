---
kind: story
size: 5
parent: "2268"
status: open
blockedBy: ["2274", "2270"]
dateOpened: "2026-07-04"
tags: []
---

# Tier-A deterministic snapshot harness for the script surface, wired into CI

Snapshot-test the deterministic script layer skills sit on — we:scripts/backlog.mjs (scaffold/resolve/settle), the we:scripts/check-*.mjs gates, and the hooks (we:scripts/lint-locus-prefix.mjs, we:scripts/guard-bash.mjs, we:scripts/guard-lane.mjs) — against the golden corpus: input fixture in, assert exit code + resulting file content. Folds in #2086 (batch carry-forward/reopen unit tests). Runs green in CI so any script change proves it breaks no historical case.
