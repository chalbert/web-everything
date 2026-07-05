---
kind: story
size: 8
parent: "2289"
status: open
blockedBy: ["2290"]
dateOpened: "2026-07-05"
tags: []
---

# JIT backlog numbering: drain assigns the NNN at land from a hash placeholder

Stop baking the NNN at creation time. A new backlog item is born with a collision-free hash id used in its branch name and filename (a hash-prefixed slug); all in-flight cross-refs (blockedBy/parent/#refs) use the hash. The drain, as sole writer, assigns the real sequential NNN just before merge — from max+1 against serialized main, so it can never race — and does a blind, safe search-replace of the hash to the final NNN across the filename, this item's frontmatter, other items' blockedBy/parent, and body refs. Use the HASH not the slug as the replace token: a hash is unique and greppable so replace is provably safe; slugs recur in prose and collide. Drain numbers in topological (blockedBy) order so a referenced item is numbered before its dependent lands. check:standards needs a provisional-hash-id state valid pre-merge. Side effect: numbers become contiguous (no burned gap numbers from closed lanes) — this is also the big-gap protection. Blocked by #2290 (drain must be sole writer first).
