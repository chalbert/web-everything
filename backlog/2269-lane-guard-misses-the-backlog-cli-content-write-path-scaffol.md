---
kind: task
status: resolved
dateOpened: "2026-07-04"
dateResolved: "2026-07-07"
graduatedTo: none
tags: []
---

# Lane guard misses the backlog CLI content-write path — scaffold/settle can write to primary

we:scripts/guard-lane.mjs is a PreToolUse(Edit|Write) hook, so it only sees the Edit/Write tools; the backlog CLI writes item files via fs.writeFileSync in writeBacklogMd (we:scripts/backlog.mjs:76), a Bash-spawned process the hook never intercepts. Frontmatter splices (claim/resolve/release/retype) writing to primary are the SANCTIONED exception and must stay exempt, but scaffold/settle CREATE content (a new item or body) — edit-work that #2123 makes lane-only — and they currently slip through: a primary scaffold is only accidentally caught by the locus-prefix content check, not the lane rule (observed live this session — a clean-title scaffold would have written a new item straight into the primary checkout). Fix, with a direct in-file precedent: the #1574 shift-left already runs the locus detector inside writeBacklogMd for exactly this fs-bypass reason. Factor guard-lane's primary-vs-lane path classification into a shared module and call it from the scaffold/settle write path, refusing a write onto a constellation primary checkout (honoring LANE_GUARD_OFF=1), while leaving the sanctioned frontmatter verbs alone. Net: creating a backlog item on the primary tree is blocked at the source, closing the hole #2123 intends.
