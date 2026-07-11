---
kind: story
size: 5
parent: "2410"
status: open
blockedBy: ["xt1lxaj"]
dateOpened: "2026-07-11"
tags: []
---

# Anti-test-gaming gates on the CI-green land clause

Deterministic anti-gaming gates: fail the land if coverage drops or tests are removed/skipped, require a test that fails on pre-change behavior for logic fixes, diff-gate author-peer test edits, and have the validator inspect for tampering. Lands in we:scripts/lib/pr-merge-gate.mjs + the we:scripts/merge-ai-prs.mjs gate + a validator-mandate clause in we:scripts/lib/review-core.mjs. Blocked by the validator (slice B). Slice C of epic #2410.
