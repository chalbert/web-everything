---
kind: story
size: 2
parent: "2387"
status: open
dateOpened: "2026-07-10"
tags: []
---

# lane-pool --base: acquire a clone based on a predecessor lane tip

Add --base=<ref> to we:scripts/lane-pool.mjs acquire: fetch + reset --hard to a given ref (a predecessor lane tip) instead of origin/main. Still a pool clone — the primary stays read-only (#2219/#104). The building block for overlap-stacked serial batches. Tests: acquire --base=<ref> lands the clone at that ref; absent --base preserves current origin/main behavior.
