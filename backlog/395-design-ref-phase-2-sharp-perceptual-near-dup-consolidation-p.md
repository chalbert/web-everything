---
type: idea
workItem: story
size: 5
parent: "382"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: []
---

# Design-ref phase 2: sharp perceptual near-dup consolidation pass

Add the near-duplicate consolidation deferred from phase 1: introduce sharp, compute a perceptual hash (aHash/dHash) per shot, and extend design-refs.mjs dedup to cluster near-dups (re-captures, crops, recompressions) that the exact sha256 pass misses. Report clusters and pick a canonical per cluster so re-runs consolidate instead of accumulating visually-identical shots.

## Implemented 2026-06-13 (batch-2026-06-13) — dwebp instead of sharp

Shipped a **dHash** perceptual pass, but decoded via the system **`dwebp -scale 9 8 -ppm`** rather
than `sharp`. Rationale: the pipeline's codified posture is system-webp-tools over a node image dep
(`pngToWebp` already shells out to `cwebp` — "no node image dep — sharp deferred"); `dwebp` is already
present alongside `cwebp` and does decode **and** downscale in one call, so `sharp` (a heavy native
dep) buys nothing here and would contradict the no-extra-dep posture. Pure helpers (`ppmToGray`,
`dHash`, `hammingHex`, `clusterByHamming`) are exported + unit-tested (10 cases); the `dwebp` decode is
the only I/O. `dedup` now reports exact (sha256) + near-dup (dHash, Hamming ≤ `--threshold`, default 5)
clusters and names a canonical (largest bytes, tiebreak earliest capture); `--apply` consolidates by
removing non-canonical dirs and repointing their sourceUrls to the canonical in the ledger (the same
skip-on-re-collect mechanism the exact-dup path uses), so re-runs consolidate instead of re-accumulating.
