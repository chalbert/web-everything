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
