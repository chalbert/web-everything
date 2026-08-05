---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# Add scripts/ to vitest coverage.include so uncovered added lines in the review path cannot pass the gate

PR #1031 review finding 4's durable half. we:vitest.config.ts's coverage.include excludes we:scripts/ entirely, so ~55 added lines in the diff-resolution path — the code that decides what every juror reads — passed the gate mechanically with no reachable assertion. Those particular lines are now covered by extracted units, but the hole that let them through is not. Start with the review path (we:scripts/fetch-parked.mjs, we:scripts/merge-ai-prs.mjs, we:scripts/lib/review-core.mjs) rather than all of scripts/ at once, since a repo-wide flip would red the gate on a large pre-existing surface and get reverted.
