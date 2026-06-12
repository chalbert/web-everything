---
type: idea
workItem: story
size: 5
parent: "315"
status: open
dateOpened: "2026-06-12"
tags: []
---

# Per-source exhaustive capability extraction — exact presence + deep doc URLs

Fan-out follow-up to #346: the first-pass capability matrix (benchmarkCapabilities.json) records a coarse cross-corpus ubiquity signal and notableIn flags, but defers exact per-source presence and deep per-(capability x source) documentation URLs. This story populates them — one batchable slice per corpus source (or small group), filling a join table so each capability cites precisely which sources provide it and where. Improves citation quality for the gap → backlog step (#348) and the diffability of re-runs. Not blocking: #347 maps on the first-pass matrix already.
