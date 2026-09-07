---
kind: story
size: 2
status: open
scope: ["we:scripts/backlog.mjs"]
relatedTo: ["2560", "2679", "2768", "2803", "xyp1wsl", "xb93l5b"]
dateOpened: "2026-09-07"
tags: [scope-lease, coordination, gap]
---

# Gap: no safe way to amend a backlog item's own frontmatter (e.g. scope) while it is actively checked out by a live session

Surfaced live during tonight's #2768 scope-narrowing task: a live-looking `prepare-2768` session appeared to
be a collision risk against an in-flight scope edit. It turned out already finished (verified by reading its
transcript), so no collision actually happened — but the near-miss exposes a real gap: there is no declared
operation, lock, or coordination mechanism for safely amending a backlog item's own frontmatter WHILE a live
session genuinely still holds that item mid-work.

## Grounding

Reading `prepare-2768`'s own transcript directly (never pinging it) showed it had already authored #2768's
scope, landed it via PR #1916, and stopped its loop minutes earlier — the agent roster's `state:working` was
stale, not live. A plain `we:scripts/backlog.mjs` frontmatter splice, or a raw card edit, assumes the target
item is idle; nothing today checks or coordinates against a genuinely live in-flight session before writing.
This is distinct from the existing scope-lease/conflict-policy engine (#2560/#2679/#2803/#2592-2599/#2593),
which reconciles a lane's OBSERVED file writes against its PREDICTED scope for launch/overlap purposes only
— none of that machinery covers changing the scope declaration TEXT itself mid-flight. Checked via
capability-search first (verdict: partial, no exact match).

Filed as a captured gap for future scoping/design, not built here — the fix shape (a lease check before a
frontmatter splice, a queued/deferred edit, an operator confirmation prompt, or something else) is an open
design question for whoever picks this up.

## Done when

1. **Executable** — TODO: this item is a captured gap, not yet scoped to a concrete deliverable. Scoping it
   (deciding the fix shape above) is itself the first unit of work before a build-ready "done when" can be
   written.
