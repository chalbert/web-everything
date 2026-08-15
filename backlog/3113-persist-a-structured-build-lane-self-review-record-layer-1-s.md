---
bornAs: x55v5xy
kind: story
size: 3
parent: "2527"
status: open
dateOpened: "2026-08-15"
tags: []
---

# Persist a structured build-lane self-review record (Layer 1) so it can be traced

Layer-1 build-time self-review (#2672/#2828) runs entirely in-session with nothing written to disk — the delivery-agent-brief screenshots, reads, and iterates, then opens the PR with no durable trace. #2818's per-item pipeline timeline can only surface a self-review stage once one exists to surface. Decide where it persists (a new event log mirroring we:scripts/lib/jury-ledger.mjs's pattern, vs. a lighter PR-comment marker) and wire the delivery-agent-brief to write it.
