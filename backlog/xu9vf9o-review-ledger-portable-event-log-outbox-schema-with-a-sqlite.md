---
kind: story
size: 8
status: open
scope: ["we:docs/agent/review-state-ledger-target.md"]
dateOpened: "2026-09-30"
tags: []
---

# Review ledger: portable event-log + outbox schema with a SQLite / Durable Objects / Postgres conformance suite

Follows ruling #4601 (2026-09-30). Define one event-log-plus-outbox schema for review and delivery events (standard in WE; engine in Frontier UI) and a conformance suite that runs the same vectors on SQLite, Cloudflare Durable Objects and Postgres, including a tested restore. Local SQLite queues pending commands only. Design: we:docs/agent/review-state-ledger-target.md. Filed for later (operator: "file the rest for later").

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
