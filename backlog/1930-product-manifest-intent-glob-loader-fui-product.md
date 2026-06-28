---
kind: story
size: 3
status: open
blockedBy: ["1929"]
dateOpened: "2026-06-28"
tags: []
---

# Product-manifest intent glob-loader (FUI/product)

Runtime impl side of #1913 (FUI/product, not WE): a per-product custom-intent manifest globbed in exactly like src/_data/intents/ (loadIntents readdir), feeding owner:intent custom intents into the resolver alongside the standard catalog. Build-time declarative seam only (the existing glob pattern); the runtime register-API is the separate demand-gated follow-up. Blocked on the WE meta-schema definition (#1929).

## Progress

- 2026-06-28 (batch-2026-06-28-1946-1945, parallel/serial lane): carried — lane agent flagged blocked-in-fact and reverted its edits, but the precise reason wasn't captured in the run ledger. Note for the next attempt: #1929 resolved as **definition + validate-script only, explicitly "no runtime loader"** (graduatedTo we:scripts/check-standards-rules.mjs), and frontierui has no `src/_data/intents/` glob or `loadIntents` substrate to mirror — so this slice likely has to stand up the FUI/product runtime intent-resolution substrate first, not just add a manifest glob. Re-investigate that substrate gap before re-claiming (may warrant a `blockedBy` prerequisite or a re-size).
