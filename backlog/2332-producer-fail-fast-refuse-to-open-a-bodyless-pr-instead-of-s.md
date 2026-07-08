---
kind: story
size: 2
status: resolved
dateOpened: "2026-07-08"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
tags: []
---

# Producer fail-fast: refuse to open a bodyless PR instead of stalling the drain on the #2324 gate

When a producer (batch closeout / we:scripts/pr-land.mjs) opens a PR with an EMPTY body, the #2324 drain-side gate correctly refuses to LAND it — but only at drain time, stalling the queue until a human fills the body (observed 2026-07-08: #2226/PR #222 opened bodyless, blocking the drain until the body was hand-filled by the drain operator). #2324 resolved the consumer-side refusal only; the producer-side prevention is missing. Fix: the producer must require a non-empty --body-file at PR-open and fail fast where the omission happens, rather than emitting a PR that stalls a later drain and needs manual repair.
