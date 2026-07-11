---
bornAs: x5xxhr7
kind: story
size: 3
parent: "2418"
status: open
dateOpened: "2026-07-11"
tags: []
---

# PR review-comment renderer from structured data

Add renderPanelComment({findings, verdict, disposition}) to we:scripts/lib/review-core.mjs (extends the existing renderPanelVerdictTable to the whole PR comment) and expose it as the review-core CLI comment subcommand. Template the render, not the prose — a renderer over structured data can't drift. Feeds the review-parked-prs Workflow (slice C).
