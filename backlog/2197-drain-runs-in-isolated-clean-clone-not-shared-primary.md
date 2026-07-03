---
kind: story
size: 3
parent: "2193"
status: resolved
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [lane, pr-flow, merge-queue, session-tooling, drain]
---

# The drain runs in an isolated clean clone, never the shared primary checkout

The `/drain` skill's precondition says *"Run from the WE checkout on `main`"* and its housekeeping does
`git pull --ff-only` **in that primary checkout**. That contradicts ratified **#2123** (every edit-action
session runs in an isolated clone, not the shared primary tree) — and the drain **is** an edit-action session:
it advances `main`. Running it in the primary is unsafe: if the primary tree carries uncommitted work from
another session (the normal case), the drain's own `git pull --ff-only --autostash` **conflicts** and strands
the tree mid-merge.

Observed live 2026-07-03: `/drain` from the primary checkout hit an autostash pop conflict on
`we:.claude/skills/batch-backlog-items/claims.json` and left the tree half-merged; recovery was manual. The
whole drain was then driven from a throwaway clone instead — which is what this slice codifies.

**Fix:** the drain provisions (or is handed) a **fresh clone on `main`** — outside `.lanes/`, isolated from any
session's working tree — does all its fetch/rebase/merge/push there, and never touches the primary checkout.
Mirrors the producer side (`we:scripts/lane-pool.mjs` clones) that #2123 already mandates. Update
`we:.claude/skills/drain/SKILL.md` so the precondition is "an isolated clean clone", not "the WE checkout on
`main`". Blocked-by nothing; independent of #2198.
