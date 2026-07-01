---
kind: story
size: 1
status: resolved
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: [backlog-ui, prioritisation, design-review, polish]
---

# Prioritisation "Hide low priority" toggle — tighten the control↔pills association

The view-level **Hide low priority** toggle sits top-right on the Prioritisation section-title line — the correct hierarchy, above the summary pills + count it recomputes (fixed in the #1034 review pass). But it's visually *distant* from those pills, so the link between the control and the pill-count change it drives reads as implicit. A user toggling it may not immediately connect it to the pills updating.

## Scope
- Explore a lighter cue that ties the toggle to the pills without breaking the hierarchy rule (control must stay **at or above** what it filters, never below): e.g. align it to the pills' right edge, add a one-word affordance, or drop it into a slim control strip directly above the pills row.
- Must NOT regress the hierarchy fix — the toggle stays level with / above the section count badge and the pills.
- Re-run `/review-design` after: target axis **#6 (grouping & proximity)** to hold/improve with no regression on **#7 (visual hierarchy)**.

## Lineage
Surfaced 2026-07-01 in the `/review-design` (#1034 rubric, v2) pass on the backlog Prioritisation UI, run after the low-priority-filter change (`data-pfiller` toggle + per-pill count adjustment). Open finding `{dimension: proximity, elementRef: "Hide low priority toggle ↔ summary pills", severity: 1}`. File: `we:src/backlog.njk`.
