---
name: feedback_no_decision_epic_conflation
description: "Never one item that is both type:decision AND workItem:epic — split into a resolved decision item + an open epic umbrella; don't resolve an epic with open children"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9115725d-1a60-4d7f-a08a-cf569fbbdb34
---

Never author (or leave) one backlog item that is **both `type: decision` and `workItem: epic`**.
The two roles have opposite lifecycles: a decision resolves the moment it's ratified; an epic must
stay `open` until its last slice lands. One item can't do both — `check:standards` **errors** on a
`resolved` epic with an open child, so you're forced to either leave a settled decision sitting
`open` (polluting decision-mode selection as a false live fork) or resolve an epic out from under
live children (gate stops you).

**Why:** discovered on #382, which was authored as `type: decision` + `workItem: epic`. With all
forks ratified but build slices still open, it could neither cleanly resolve (gate blocks resolving
an epic with open child #481) nor stay honest as an open decision. I briefly resolved it anyway —
the gate hard-errored — and reverted.

**How to apply:** when a program needs both a design call AND a build umbrella, author **two
items** — a `type: decision` (resolves on ratification) + a separate non-decision `workItem: epic`
(`type: idea`/`issue`, stays open until slices resolve), linked by `parent` (or epic `blockedBy`
decision while open). For an existing conflated item: retype it to the umbrella, scaffold a fresh
resolved `type: decision` child holding the fork content, trim the forks out of the epic leaving a
pointer. Worked example: #382 (epic) split → #581 (resolved decision) on 2026-06-14.

**The IMPLIED conflation still slips in (user feedback 2026-06-20).** The merged single-`kind` schema
made the *literal* both-at-once impossible, but an epic still buries a decision when it (a) narrates an
open fork in its body, or (b) carries `childlessReason: undecided` as a stand-in for a pending design
call. Fix = same carve: separate `kind: decision` the epic `blockedBy`-depends on, and **author the
epic to depend on its decision item from the start** rather than carving the fork out later.

**`childlessReason: undecided` is now RETIRED ENTIRELY (user: "should be using blockedBy", 2026-06-20).**
Earlier guidance reserved it for "slices not yet scoped" — that loophole is closed because the value
*renders as a "needs decisions" badge* regardless of intent. `check:standards` now **errors** on
`childlessReason: undecided` (epic side) AND `unsplittableReason: undecided` (story side). The two
legitimate states it conflated are now distinct: (1) gated on a design call → `kind: decision` item +
`childlessReason: blocked` + a `blockedBy` edge to it; (2) decision settled but slices not yet scoped
(audit must run first) → just **unsliced**: NO `childlessReason` at all → the *slice* badge (slice 1 is
the audit). The valid `CHILDLESS_REASONS` are now blocked|untriaged|program; valid `UNSPLITTABLE_REASONS`
are foundational|atomic|fixture. NOTE: `blockedBy` to a *fully-resolved* decision is auto-dropped by
`check-readiness --apply` and warned by `check:standards` (stale-block) — for a resolved decision the
durable lineage is the bidirectional prose cross-link, not a frontmatter edge. Both #1245→#1246 and
#1250→#1270 (2026-06-20) were already split correctly; the residual was only the stale `undecided`
marker (cleared). Codified in: scripts/check-standards.mjs (the two new errors), backlogMeta.js (meta
entries removed), src/backlog.njk (legend), .claude/commands/resolve.md, and docs/agent/backlog-workflow.md
→ *Closing out* + *Splitting* + *Rules*. Same family as
[[feedback_decisions_are_workitems_not_plan_mode]] (a fork is its own work item) — this extends it
to the umbrella level. Don't resolve an epic with open children: [[feedback_backlog_closeout_resolve_not_delete]].
