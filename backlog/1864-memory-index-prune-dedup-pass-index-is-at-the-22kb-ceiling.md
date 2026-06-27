---
kind: task
parent: "1855"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Memory-index prune + dedup pass — index is at the 22KB ceiling

The we:MEMORY.md index sits at 21.9KB of its 22KB budget across 144 topic files, so nothing new can be indexed without pruning. Do a relevance + redundancy pass over the 98 feedback and 44 project memories: find superseded or duplicate entries, right-home detail into the linked files, and drop or merge low-value lines to recover headroom. This is the instruction-redundancy metric of the model-usage watch (#1855) made concrete.
