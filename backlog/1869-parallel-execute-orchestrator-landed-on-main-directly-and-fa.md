---
kind: story
size: 5
parent: "1147"
relatedItems: ["1153"]
status: open
dateOpened: "2026-06-27"
tags: []
---

# parallel-execute orchestrator landed on main directly and falsely reported a stranded lane resolved

The first real multi-lane `/workflow` batch (batch-2026-06-27-1787-1834: 12 items, 5 concurrent / 7 serial / 5 conflict-replays) exposed two defects in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` that both risk silent loss and break the documented one-merge safety model. Fix the script so the integration assembly lands on a throwaway `batch-parallel/*` branch for the main agent to merge once — never the live branch — and so the per-lane ledger reflects the **merged** tree, not a worktree's optimistic local state. Discovered as the #1153 live-validation run.

## The two defects

1. **Landed on `main` directly.** The contract (the skill's "Parallel lanes" non-negotiables + the script header) is: the workflow *never* writes the live branch; it returns `integrationBranch` and the main agent does the single `git merge --no-ff`. In practice the assembly was already committed onto `main` (HEAD was the derived-regen commit `a99d5f9a … batch #1787/#1834`), and no `batch-parallel/*` branch existed to merge. The one-merge abort point — a bad assembly never touching the shared branch — was lost.

2. **Ledger reported a stranded lane as `resolved`.** #1829's resolve commit (`we:webinjectors/contract.ts`, types-only, clean) was reported `resolved` in the returned ledger but **never merged out of its worktree branch** — it sat only on the worktree branch `worktree-wf_c5c5c953-077-15`. The main agent caught it on a ledger-vs-tree reconcile (`status: open` on `main` despite ledger `resolved`) and cherry-picked it. Had the reconcile been skipped, the work would have been silently dropped when the worktree was pruned.

## What good looks like
- The workflow returns an `integrationBranch` that **exists** and is **not** `main`; the main agent performs the only write to the live branch.
- A lane's ledger entry is marked `resolved` **only after** its commit is verified present on the integration branch — a worktree-local resolve that fails to merge surfaces as a conflict/replay or an explicit `stranded` status, never a false `resolved`.
- Add a post-integration assertion: every ledger-`resolved` item's resolve commit is reachable from `integrationBranch`.

Lineage: parent epic #1147 (parallel execute on the Workflow tool); surfaced by the #1153 live-validation gate.
