---
type: issue
workItem: story
size: 5
parent: "904"
status: open
locus: webeverything
blockedBy: ["916", "917", "918", "919", "920", "921", "922", "923", "924", "925"]
dateOpened: "2026-06-18"
tags: []
---

# Add export-shape arm to the block drift gate (CEM surface vs actual impl exports)

Extend validateBlockImplConformance (we:scripts/check-standards-rules.mjs) with a second arm that compares each block's declared exports/CEM surface against the resolved FUI impl module's ACTUAL exports — the deeper content-equality the #170 hazard implies (#659 shipped impl-existence only). Needs a TS export parse of the resolved impl; gated on all 10 impls existing (#916–#925) so there are exports to parse. locus webeverything. Slice of #904.
