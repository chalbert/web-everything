---
kind: epic
parent: "1971"
status: open
dateOpened: "2026-07-01"
blockedBy: ["2030"]
childlessReason: blocked
tags: []
---

# SSR & hydration of comment-anchor directive regions

Deferred Phase-2 branch of #1971: server-render comment-anchor regions (markers + stamped content), then client-side hydrate (recognize markers, skip re-stamp), with directive state serialized in comment text; streaming/lazy hydration of nested regions. Seeded from #1971's build list.

**No child slices yet — blocked on the foundational design #2030.** `/slice 2005` (2026-07-01) ruled this could-not-split: no SSR surface exists in FUI today (`fui:plugs/webdirectives/` is parse/lifecycle only — no server renderer, no hydration hook), so the four proposed children (serialize / server-render / hydrate / streaming) have no design *and* no impl — slicing would only scatter one unmade decision. That decision now lives in **#2030** (its own `kind: decision` card). Once #2030 resolves, re-run `/slice 2005` to cut the serialize / server-render / hydrate / streaming stories with real seams. See `we:reports/2026-07-01-backlog-split-analysis.md`.
