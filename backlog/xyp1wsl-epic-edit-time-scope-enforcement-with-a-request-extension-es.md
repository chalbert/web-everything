---
kind: epic
status: open
scope: ["we:scripts/guard-lane.mjs", "we:scripts/readiness/scope-lease.mjs", "we:scripts/lib/lane-lease.mjs", "we:scripts/lane-pool.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
relatedTo: ["xezrute", "xjma1x9", "2560", "2679", "2574"]
dateOpened: "2026-09-07"
tags: [scope, scope-lease, guard, enforcement]
---

# Epic: edit-time scope enforcement with a request-extension escape valve

Declared backlog scope: is currently ADVISORY ONLY at runtime — nothing structurally blocks a dispatched agent's Edit/Write outside its own item's declared scope. we:scripts/guard-lane.mjs (PreToolUse Edit|Write) enforces only primary-vs-lane locus (#2123) and lane-occupancy/lease-holder checks (#2997) — zero scope logic (confirmed by full read). we:scripts/guard-bash.mjs and we:scripts/backlog-guard.mjs likewise have no scope-vs-edit-target check. The plumbing to make scope a checkable runtime fact already exists though: we:scripts/operations/dispatch-lane.mjs's fillBrief tells the dispatched agent to run we:scripts/lane-pool.mjs acquire --scope={{SCOPE}} --item={{ITEM_NUM}}, and we:scripts/lane-pool.mjs persists that into the lane's own lease marker as predictedScope (we:scripts/lib/lane-lease.mjs) — the SAME lease file we:scripts/guard-lane.mjs already reads for its occupancy check. Today predictedScope is used only for a non-blocking cross-lane overlap warning at acquire (we:scripts/lane-pool.mjs ~1162-1177) and a REACTIVE post-hoc breach detector (we:scripts/readiness/scope-lease.mjs's breachOf/breachOutcome, fed by a git diff --name-only read in we:scripts/readiness/scope-lease-collect.mjs) — never a preventive PreToolUse block before the write lands. This epic closes that gap: a we:scripts/guard-lane.mjs arm that blocks an Edit/Write outside the CURRENT item's own declared scope at write time, plus a formal, trackable scope-extension REQUEST flow for the genuine case an agent needs to touch something outside its declared bounds mid-work, rather than silently editing outside bounds. relatedTo xezrute (the broader, still-unscoped gap that nothing coordinates safely amending a backlog item's own frontmatter — including scope: — while a live session holds that item; this epic's extension-request flow is one specific, narrower consumer of that same underlying capability, deliberately not merged into it since xezrute covers other amenders and fields too). Distinct from xjma1x9 (filing-time gate on how BROAD a scope declaration is allowed to be) and #3562/#3576 (what gets prepared) — this epic is pure RUNTIME ENFORCEMENT.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
