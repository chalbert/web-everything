---
kind: story
size: 3
status: open
blockedBy: ["1948"]
dateOpened: "2026-06-28"
tags: []
---

# Product-manifest intent glob-loader (FUI/product)

Runtime impl side of #1913 (FUI/product, not WE): a per-product custom-intent manifest globbed in exactly like src/_data/intents/ (loadIntents readdir), feeding owner:intent custom intents into the resolver alongside the standard catalog. Build-time declarative seam only (the existing glob pattern); the runtime register-API is the separate demand-gated follow-up. Blocked on the WE meta-schema definition (#1929).

## Progress

- 2026-06-28 (batch-2026-06-28-1946-1945, parallel/serial lane): carried — lane agent flagged blocked-in-fact and reverted its edits, but the precise reason wasn't captured in the run ledger. Note for the next attempt: #1929 resolved as **definition + validate-script only, explicitly "no runtime loader"** (graduatedTo we:scripts/check-standards-rules.mjs), and frontierui has no `src/_data/intents/` glob or `loadIntents` substrate to mirror — so this slice likely has to stand up the FUI/product runtime intent-resolution substrate first, not just add a manifest glob. Re-investigate that substrate gap before re-claiming (may warrant a `blockedBy` prerequisite or a re-size).
- 2026-06-28 (batch-2026-06-28-parallel pre-flight): **substrate gap VERIFIED, re-blocked.** Grepped frontierui — **zero** references to WE's `intentProfileResolver`/`resolveTraits`/`bundlePlan`, no `src/_data/intents/` glob, no `loadIntents`, no product-manifest concept anywhere. There is no FUI-side intent-catalog-assembly + resolver-invocation pipeline for a product manifest to feed into; the seam #1913 says to "mirror" (`src/_data/intents/`) exists only in WE. Filed the prerequisite **#1948** (FUI/product intent-resolution substrate) and re-pointed `blockedBy: ["1948"]` (the #1929 edge is resolved/satisfied). Dropped from this batch as `blocked-in-fact`, not a gut stop.
