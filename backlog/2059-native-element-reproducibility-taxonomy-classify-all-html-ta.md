---
kind: story
size: 5
status: open
dateOpened: "2026-07-01"
tags: []
---

# Native-element reproducibility taxonomy: classify all HTML tags for block packaging

Classify every native HTML tag into the three block-packaging buckets ratified by #2028: (1) host-reproducible (role+ARIA only) -> host-is-node via ElementInternals; (2) irreplaceable-native (unique rendering/interaction) -> wrap a real child (#1962 (B)); (3) content-model-constrained (parent accepts only the real tag) -> reserved transient (#1962 (A)). Becomes the reference block-packaging decision rule so the catalog inherits one lookup instead of per-block judgment. Lives in block-standard §7 / #1962 lineage.
