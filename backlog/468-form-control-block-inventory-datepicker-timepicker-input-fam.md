---
type: idea
workItem: epic
parent: "099"
relatedReport: reports/2026-06-13-backlog-split-analysis.md
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: webblocks slices #471–#474 (input/checkbox/toggle/radio); datepicker+timepicker → #359
tags: []
---

# Form-control block inventory — datepicker, timepicker, input family, toggle/radio/checkbox

Umbrella for the standalone form-control block inventory under webblocks. Sliced (2026-06-13) into per-control blocks: input family (#471), checkbox (#472), toggle/switch (#473), radio group (#474) — each native-first over its form element. #177 (form-block), #359 (date-range), #175 (slider), #176 (segmented) exist already.

**Datepicker / timepicker → tracked by #359 (handed off):** #359 ("Date / time / range picker block") already covers calendar-based date, time, and range. Whether single-value date/time pickers are their own blocks or variants of #359 is a Tier-B scope call to settle in #359's own split (it's a `size·8` story under gap-sweep #315). #359 carries the reciprocal note and now owns that reconciliation outright. Datepicker has the most fleshed-out feature list in the book. From #111 triage.

**Resolved 2026-06-13:** all four build slices landed — input family (#471), checkbox (#472), toggle/switch (#473), radio group (#474), each native-first over its form element. The remaining datepicker/timepicker scope is delegated to #359; nothing else in this umbrella is open.
