---
type: idea
workItem: epic
parent: "1042"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:plugs/webstates/CustomChangeStrategy.ts"
tags: []
---

# webstates completion: change-tracking + storage protocols (reconcile #503)

L3 completion sub-epic (parent #1042, audit §10). webstates' biggest gap: change-tracking AND storage protocols are entirely absent (we:plugs/webstates/ holds only CustomStore; spec we:src/_includes/project-webstates.njk). Reconcile #503 (resolved size-5 story recorded as delivering the storage protocol, but the L3 pass found no storage impl — either it lives elsewhere or #503 didn't deliver). Slice into concrete fix-stories with file:line grounding when picked.
