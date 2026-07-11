---
bornAs: xja00k1
kind: task
parent: "2418"
status: open
dateOpened: "2026-07-11"
tags: []
---

# Session/notice renderers from structured data

Render the recurrent outbound artifacts from {findings, verdict, disposition} instead of hand-typed prose: the drain end-of-run summary, the close-session report, and the escalation/clearance notice. Template the render, not the prose. Single-sourced in we:scripts/lib/review-core.mjs so /drain and /review can't drift.
