---
bornAs: x1k0zfj
kind: story
size: 5
parent: "4075"
status: open
blockedBy: ["4065"]
scope: ["we:scripts/conveyor/health-smells/"]
dateOpened: "2026-09-24"
tags: []
---

# Health daemon slice 4: queue and host smells — PR stage stalls, open unaccepted PRs over limit, stray labels, stood-down PRs, lane pool growth, machine load, App token and rate limit

Fourth slice of 4065: the remaining seed smells. PRs stuck per stage aggregates the stuck-PR watch's own markers (we:scripts/conveyor/stuck-pr-dispatch-marker.mjs) and never double-dispatches; open unaccepted PRs above the backpressure limit reads the limit from the open-PR backpressure work (x55tmjy); contradictory or stray review labels; stood-down PRs; lane pool growth and dirty-lane accumulation; host load average; GitHub App token trouble and rate-limit headroom. Most are alert-only per the ruling.

## Done when

1. **Executable** — each new smell has a fixture-driven unit test through the slice-1 core; the systemic
   stuck-PR smell is proven alert-only (it never plans a dispatch); App-token and high-load episodes are
   proven to inhibit agent dispatch.
2. **Live proof** — each probe runs against the live fleet in `shadow` with its reading shown.
