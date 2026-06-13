---
type: idea
workItem: story
size: 3
parent: "382"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
relatedReport: reports/2026-06-13-design-ref-vision-pipeline.md
tags: [design-reference, corpus, vision, training-data, distillation, quarantine]
---

# Archive quarantined frames + persist (frame,verdict) pairs as a labeled training corpus

The vision gate (#480) **discards** quarantined frames — marketing / error / blank shots only get
their URL logged to `needs-review.json`, no image saved. But those are exactly the labeled
**negatives** an on-device UI-screenshot classifier needs (#488). Extend the gate to retain every
judged frame with its verdict as a labeled pair, so dev runs accumulate a `{frame, verdict}` training
set from day one — turning the WE-development gate into the distillation-data collector for the
on-device model (the platform-reinforcing loop).

## Approach

- Write quarantined frames to a holding area — `design-refs/quarantine/<hash>/{screenshot.webp,meta.json}`
  — append-only + content-addressed like the admitted corpus, but **kept off** the `/research/design-references/`
  browse page (it renders the admitted corpus, not rejects).
- Each record carries its `visionVerdict` (verdict + reasons + provider), so the join with `verdicts.json`
  is already materialised on disk; admitted shots already carry it in their `meta.json`.
- Result: a single labeled set spanning all six verdicts (admitted `app` + quarantined negatives),
  ready to export as the distillation corpus for #488.
- Idempotent: a quarantined frame's hash dedupes the same way; re-runs don't churn.

## Relationships

- **parent #382** · runs against the shipped gate (**#480**), no hard blocker — agent-ready.
- **#488** · this is the training-data collector for the on-device-model decision; its value is realised there.
