---
kind: story
size: 5
status: open
blockedBy: []
parent: "1585"
dateOpened: "2026-06-22"
relatedProject: webaudit
tags: []
---

# Author the design-knowledge weighting meta-schema + computation function (graduate #1588)

Graduates the ratified #1588 ruling: author the source-admission/credibility meta-schema as WE config+data — the source-`kind` enum, the fixed named modifier vocabulary (up: breadth/diversity, independent-replication; down: narrow-sample, vendor-funded-bias, staleness), and the weight-computation function (baseline tier from kind + optional modifiers, each carrying rationale+attribution; only staleness deterministic) plus a default tier-weight flavor. Two-stage: a provenance/content admission floor (identifiable+traceable+on-topic, NOT a quality bar) then the weight, with a nonzero floor on admitted sources. Backfill the #1586 ledger's provisional equal `credibilityWeight` column with computed weights. Meta-schema frozen as the comparable spine; project config extends weights/kinds. Unblocks #1589.
