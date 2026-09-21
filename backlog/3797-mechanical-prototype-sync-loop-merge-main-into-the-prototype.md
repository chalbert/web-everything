---
bornAs: xfgv680
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["x86eyvl", "xm96s8j"]
relatedTo: ["3772", "3472", "3443", "3607", "3556", "3464", "3553"]
scope: ["we:scripts/conveyor/branch-sync.mjs", "we:scripts/lib/poc-branches.mjs", "we:scripts/lib/poc-branches.json", "we:scripts/operations/poc-land.mjs", "we:scripts/readiness/drain-lock.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Mechanical prototype sync loop: merge main into the prototype branch and push it fast-forward only

The prototype branch `lane/mechanical-dispatcher` must be kept up to date with `main` mechanically: a merge commit (never a rebase, never a force-push), pushed fast-forward only after a clean merge; on a conflict only the sync merge freezes, a reconcile agent resolves it on a staging ref, and the pass promotes that ref once the tests are green there, alerting the operator only when they must act (ruled 2026-09-21 by decision #3804; this sentence first said "with a freeze and an alert on conflict"). Today nothing does that, and the one process that tries cannot push. Design-first and deliberately not cleared for the conveyor. Relates #3772 (the merge POLICY: who, when, conflict rules, duplicate ids), #3472, #3443 (graduation) and #3607 (the reconcile agent); this card is the LOOP that carries out that policy, so settle #3772's policy points first or together.

## FOUND (2026-09-21)

- **`branch-sync` never pushes.** we:scripts/conveyor/branch-sync.mjs (#3472) merges `origin/<base>` into a scratch clone with a working-tree-free conflict probe, bounded backoff and an alert file. It contains no `git push` invocation (its only `push` calls are array pushes), so its merges reach nothing shared.
- **Its live process is stuck.** pid 81962 (started Mon Sep 7 11:11 EDT) runs `we:scripts/conveyor/branch-sync.mjs loop` against `wev-scratch-dispatcher-4`. In that clone the loop state file (in its git directory) reads attempt 5, `firstFailedAt` 2026-09-12T16:34Z, `lastAttemptAt` 2026-09-21T13:45Z, and its alert file carries signature `21d90da926af`. That clone is on `lane/mechanical-dispatcher` and, by its own local refs (which may be stale), 722 commits behind and 83 ahead of `origin/main`.
- **The registry gate is defined and unread.** we:scripts/lib/poc-branches.json marks `lane/mechanical-dispatcher` with `autoSync: true`, and `resolveAutoSyncEnabled` in we:scripts/lib/poc-branches.mjs resolves it (kill switch `WE_POC_BRANCH_SYNC=0`). A search of we:scripts/ and we:skills-src/ finds no caller of it outside its own file and tests.
- **A per-branch write lock exists.** `withPocLandLock` in we:scripts/readiness/drain-lock.mjs, used by we:scripts/operations/poc-land.mjs, whose header calls out collision with the `branch-sync` loop as an engineering problem to solve.
- **A hand merge cost 54 conflicts.** A dry-run merge of main into the branch showed 54 conflicted files. An agent resolved it once onto the staging ref `origin/lane/mechanical-dispatcher-catchup` (sha dd9d51bfb at the time; 390 files changed, `check:standards` 0 errors) and recorded five judgment forks in the orchestrator's catch-up result file, which is a local file outside the repo. Checked 2026-09-21 after a fetch: the staging ref is NOT contained in `origin/lane/mechanical-dispatcher`, and `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` reads 446 commits only on main and 253 only on the branch.

## DESIGN TO SETTLE

1. **Where it runs.** A dedicated clone owned by the loop, never a checkout an agent works in.
2. **Push rule.** `git push` fast-forward only, and only after the merge is clean; refuse on a moved tip and retry from a fresh fetch. No force, ever. *Ruled by #3804 (statute point 1): a clean sync merge is pushed with no test gate, by design; the cover is #3768 design point 6. The test gate applies only to promoting a resolved staging ref (statute point 2). This point first also required "the branch's own checks pass" before a clean push.*
3. **Locking.** Take `withPocLandLock` for the branch around fetch, merge and push, so it serializes with the fast-lander.
4. **The gate.** Read `resolveAutoSyncEnabled` per branch, with the kill switch honored; nothing reads it today.
5. **Conflict handling.** Freeze only the sync merge on a conflict and hand the conflict to a reconcile agent (#3607, #3556) that works on a staging ref, never on the shared branch; the pass promotes it once the tests are green there. No alert is raised while the agent works; the operator is alerted only when the agent's one attempt failed or the tests on the resolved staging ref are red (#3835). *Ruled by #3804 (statute points 2 and 3); this point first said "raise the existing alert" on every conflict.*
6. **Cadence.** Timer, or after each landing on main, or when the main-only commit count passes a threshold (#3772 point 1). *Ruled by #3804 Fork 1: prompt, the next pass merges whatever `main` has; the 40-commit ceiling is only a backstop; the trigger is this item's build choice.*
7. **Duplicate backlog ids** on the merge (#3772 point 3) and what a slice's graduation needs from a fresh merge (#3772 point 4). *Graduation is ruled by #3804 Fork 4 (a slice graduates any time; built by #3836); duplicate ids stay open on #3772.*
8. **The stuck process.** Retire pid 81962 and the scratch-clone loop, or repoint it, as part of landing this.

## Finding (2026-09-21): the open policy calls are decision card 3804; one FOUND line above is incomplete

Design points 6 (cadence) and 5 (conflict handling), plus the alert path and when a slice may graduate, are filed as decision card 3804 (uncleared, not yet prepared); settle it before or with this loop. One correction to the FOUND list: `we:scripts/conveyor/branch-sync.mjs` never pushes, but on the prototype branch only, `we:scripts/conveyor/poc-branch-sync.mjs` already builds the merge commit with git plumbing and pushes it plainly (never forced) under `withPocLandLock`, gated on the registry's `autoSync` flag, and the runner calls it each tick. So the resolver of design points 2 to 4 is largely written there and is not on `main`; whether it has ever pushed a real merge live is not verified. Also: the staging ref `origin/lane/mechanical-dispatcher-catchup` is no longer a fast-forward of the branch (12 commits landed after it was cut), and the five judgment forks of that merge are decision card 3803.

## Ruling (2026-09-21): decision #3804 is ratified; this loop builds points 1 and 2

Codified in `we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`. For this loop: **cadence** is prompt, the next pass merges whatever `main` has and the 40-commit ceiling stays only as a backstop; **on a conflict** the pass dispatches the reconcile agent (#3607) onto the staging ref and, once the branch's tests are green at that exact commit as the pass itself sees them, promotes the staging ref by a plain fast-forward push under the same lock and `autoSync` gate; at most one attempt is in flight, and only the sync merge freezes. **The alert** is its own item (the record on an ops branch, a digest line and a wip row; `blockedBy` #3726). The trigger mechanism (today the runner tick) is this item's build choice.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/branch-sync.test.mjs` passes, with new cases on real throwaway git fixtures that fail today: a clean merge is pushed fast-forward only and the remote tip equals the merge commit; a moved remote tip is refused and retried from a fresh fetch, never forced; a conflicting merge pushes nothing to the shared branch, freezes only the sync merge (direct pushes to the branch still land), dispatches the reconcile agent (#3607) once per conflicting file set, and raises no alert while the agent works; a branch with `autoSync: false` (or `WE_POC_BRANCH_SYNC=0`) is not touched and raises no alert; the merge holds `withPocLandLock` so a concurrent fast-land waits, and a held lock skips the pass with no push and no alert, retried on the next tick. The promotion of a resolved staging ref has the cases of #3607 Done-when 8 (one test may serve both): fast-forward AND green at that exact commit as the pass runs the tests → pushed; red → nothing pushed, `gate-red`, not retried on its own; a fix commit on the staging ref then green → promoted and the alert clears; the agent gave up → `agent-failed`; the shared branch moved → its newer commits merged into the staging ref and the tests re-run, a conflict there being a new conflict; `main` moved meanwhile → promotion still goes ahead. *Amended 2026-09-21 by decision #3804 (statute `#poc-branch-mechanical-sync` points 2 and 3); this item first said a conflicting merge "pushes nothing, freezes the loop and writes the alert".*
2. **Observable** — after one live tick on which `main`'s new commits merge clean, `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` shows zero commits only on main, and no commit on the branch has been rewritten (its old tip is an ancestor of the new one).
