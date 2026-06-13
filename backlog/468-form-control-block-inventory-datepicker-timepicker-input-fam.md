---
type: idea
workItem: epic
parent: "099"
relatedReport: reports/2026-06-13-backlog-split-analysis.md
status: open
dateOpened: "2026-06-13"
tags: []
---

# Form-control block inventory — datepicker, timepicker, input family, toggle/radio/checkbox

Umbrella for the standalone form-control block inventory under webblocks. Sliced (2026-06-13) into per-control blocks: input family (#471), checkbox (#472), toggle/switch (#473), radio group (#474) — each native-first over its form element. #177 (form-block), #359 (date-range), #175 (slider), #176 (segmented) exist already.

**Held pending #359 reconciliation:** datepicker and timepicker — #359 ("Date / time / range picker block") already covers calendar-based date, time, and range. Whether single-value date/time pickers are their own blocks or variants of #359 is a Tier-B scope call to settle in #359's own split (it's a `size·8` story under gap-sweep #315). This epic stays their tracker until then. Datepicker has the most fleshed-out feature list in the book. From #111 triage.
