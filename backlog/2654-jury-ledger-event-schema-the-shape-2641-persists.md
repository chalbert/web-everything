---
bornAs: xiiyuvd
kind: story
size: 3
parent: "2649"
status: open
blockedBy: ["2653"]
scope: ["we:scripts/lib/"]
dateOpened: "2026-07-24"
tags: []
---

# Jury ledger event schema (the shape #2641 persists)

Define the append-only jury-ledger event vocabulary + a pure validator in we:scripts/lib/jury-core.mjs (roster-picked, juror-running, finding, verdict, round-advanced). Typed shape #2641's durable log and the #2642 console serialize. Schema only — not the on-disk log or the fold (those are #2641).
