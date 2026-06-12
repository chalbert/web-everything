---
type: idea
workItem: story
size: 5
parent: "382"
status: open
dateOpened: "2026-06-12"
tags: []
---

# Design-ref phase 2: sharp perceptual near-dup consolidation pass

Add the near-duplicate consolidation deferred from phase 1: introduce sharp, compute a perceptual hash (aHash/dHash) per shot, and extend design-refs.mjs dedup to cluster near-dups (re-captures, crops, recompressions) that the exact sha256 pass misses. Report clusters and pick a canonical per cluster so re-runs consolidate instead of accumulating visually-identical shots.
