---
kind: decision
parent: "xyp1wsl"
status: open
scope: ["we:scripts/guard-lane.mjs", "we:scripts/readiness/scope-lease.mjs", "we:scripts/conveyor/stand-down.mjs", "we:scripts/backlog-guard.mjs"]
relatedTo: ["xezrute", "xjma1x9", "xfxt77w"]
dateOpened: "2026-09-07"
tags: [scope, decision, escalation]
---

# Decision: how does a scope-extension REQUEST from a dispatched agent get resolved

Once xfxt77w blocks an out-of-scope Edit/Write, a dispatched agent that genuinely needs to touch something outside its declared scope mid-work needs a real escape valve — a REQUEST to extend scope, not a silent bypass. Open fork: HOW does that request get resolved? Option A, auto-approve if the requested addition still passes we:scripts/backlog-guard.mjs's filing-time breadth gate (xjma1x9, tiered bare-top-level/subdirectory/file rule) and does not overlap another live lane's declared scope (reuse we:scripts/readiness/scope-lease.mjs's existing overlap check). Option B, always require a human to approve (mirrors we:scripts/conveyor/stand-down.mjs's durable-marker escalation shape — post a durable, trackable request record and pause until a person clears it; PR-scoped stand-down itself does not fit directly since this happens pre-PR inside a live lane, so the request channel needs its own home, e.g. a lane-local request file or an item comment-equivalent). Option C, dispatch a quick mechanical judgment pass (a fresh small dispatched investigation, or reuse stand-down's escalation shape) that checks the request against this repo's own breadth/overlap rules and auto-resolves the mechanical cases, escalating only genuine judgment calls to a human. Recommended default, grounded in this repo's own mechanical-first bias (regular cases mechanical, escalate only judgment calls): Option C, because it is the only option that both (1) never silently widens scope on an agent's own say-so (unlike a bare A) and (2) does not burn a human's attention on the common case of a narrow, obviously-fine addition (unlike a blanket B). GENUINE FORK, do not resolve silently — whichever option is picked, the write-back that actually amends the item's scope: frontmatter while the requesting session is still live needs a safe amend-while-live mechanism that does not exist yet (xezrute, filed as a captured, unscoped gap) — this decision's resolution is practically gated on xezrute being scoped/resolved for any path other than a pure human-rejection outcome.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
