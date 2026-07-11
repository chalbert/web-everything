---
kind: story
size: 5
parent: "2410"
status: open
dateOpened: "2026-07-11"
tags: []
---

# Independent hardened validator + redteam:accepted acceptance label

A distinct fresh-context adversarial validator judges the final diff (diff+tests+rubric only, never the peers' self-assessment); extends the existing panel reducers (buildPanelMandate/derivePanelVerdict in we:scripts/lib/review-core.mjs) into a diverse jury and persists a deterministic redteam:accepted label (new vocab in we:scripts/lib/review-escalation.mjs, per #2281). PRODUCES the label; the merge-gate enforcement stays with #2412. Where the non-author-accepts invariant lives. Slice B of epic #2410.
