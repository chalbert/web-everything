---
bornAs: xf1t3wj
kind: story
size: 3
parent: "4075"
status: open
dateOpened: "2026-09-27"
tags: []
---

# Run rating: spot-check sampling switch

Slice (e) of run rating & efficiency (parent #4075). Slice (b)'s cross-model judge pass costs real tokens per
run judged, so judging every single dispatch is not always the right default at fleet scale. This item adds a
declared sampling switch (a rate or a rule — e.g. every Nth run, or every run below a mechanical grade
threshold) that controls what fraction of runs get the expensive judge pass on top of slice 1's always-on
mechanical grade, so judge cost scales with fleet volume instead of growing linearly with it.

## Done when

1. **Executable** — a command/config toggle selects which fraction or which class of finished runs get judged,
   verifiable by running the judge dispatcher against a fixture set and counting how many were actually
   selected under a given switch setting.
