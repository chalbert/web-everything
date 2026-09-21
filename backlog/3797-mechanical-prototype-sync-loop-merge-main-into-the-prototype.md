---
bornAs: xfgv680
kind: story
size: 5
parent: "3383"
status: open
relatedTo: ["3772", "3472", "3443", "3607", "3556", "3464", "3553"]
scope: ["we:scripts/conveyor/branch-sync.mjs", "we:scripts/lib/poc-branches.mjs", "we:scripts/lib/poc-branches.json", "we:scripts/operations/poc-land.mjs", "we:scripts/readiness/drain-lock.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Mechanical prototype sync loop: merge main into the prototype branch and push it fast-forward only

The prototype branch `lane/mechanical-dispatcher` must be kept up to date with `main` mechanically: a merge commit (never a rebase, never a force-push), pushed fast-forward only after a clean merge, with a freeze and an alert on conflict. Today nothing does that, and the one process that tries cannot push. Design-first and deliberately not cleared for the conveyor. Relates #3772 (the merge POLICY: who, when, conflict rules, duplicate ids), #3472, #3443 (graduation) and #3607 (the reconcile agent); this card is the LOOP that carries out that policy, so settle #3772's policy points first or together.

## FOUND (2026-09-21)

- **`branch-sync` never pushes.** we:scripts/conveyor/branch-sync.mjs (#3472) merges `origin/<base>` into a scratch clone with a working-tree-free conflict probe, bounded backoff and an alert file. It contains no `git push` invocation (its only `push` calls are array pushes), so its merges reach nothing shared.
- **Its live process is stuck.** pid 81962 (started Mon Sep 7 11:11 EDT) runs `we:scripts/conveyor/branch-sync.mjs loop` against `wev-scratch-dispatcher-4`. In that clone the loop state file (in its git directory) reads attempt 5, `firstFailedAt` 2026-09-12T16:34Z, `lastAttemptAt` 2026-09-21T13:45Z, and its alert file carries signature `21d90da926af`. That clone is on `lane/mechanical-dispatcher` and, by its own local refs (which may be stale), 722 commits behind and 83 ahead of `origin/main`.
- **The registry gate is defined and unread.** we:scripts/lib/poc-branches.json marks `lane/mechanical-dispatcher` with `autoSync: true`, and `resolveAutoSyncEnabled` in we:scripts/lib/poc-branches.mjs resolves it (kill switch `WE_POC_BRANCH_SYNC=0`). A search of we:scripts/ and we:skills-src/ finds no caller of it outside its own file and tests.
- **A per-branch write lock exists.** `withPocLandLock` in we:scripts/readiness/drain-lock.mjs, used by we:scripts/operations/poc-land.mjs, whose header calls out collision with the `branch-sync` loop as an engineering problem to solve.
- **A hand merge cost 54 conflicts.** A dry-run merge of main into the branch showed 54 conflicted files. An agent resolved it once onto the staging ref `origin/lane/mechanical-dispatcher-catchup` (sha dd9d51bfb at the time; 390 files changed, `check:standards` 0 errors) and recorded five judgment forks in the orchestrator's catch-up result file, which is a local file outside the repo. Checked 2026-09-21 after a fetch: the staging ref is NOT contained in `origin/lane/mechanical-dispatcher`, and `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` reads 446 commits only on main and 253 only on the branch.

## DESIGN TO SETTLE

1. **Where it runs.** A dedicated clone owned by the loop, never a checkout an agent works in.
2. **Push rule.** `git push` fast-forward only, and only after the merge is clean and the branch's own checks pass; refuse on a moved tip and retry from a fresh fetch. No force, ever.
3. **Locking.** Take `withPocLandLock` for the branch around fetch, merge and push, so it serializes with the fast-lander.
4. **The gate.** Read `resolveAutoSyncEnabled` per branch, with the kill switch honored; nothing reads it today.
5. **Conflict handling.** Freeze the loop on a conflict, raise the existing alert, and hand the conflict to a reconcile agent (#3607, #3556) that works on a staging ref, never on the shared branch.
6. **Cadence.** Timer, or after each landing on main, or when the main-only commit count passes a threshold (#3772 point 1).
7. **Duplicate backlog ids** on the merge (#3772 point 3) and what a slice's graduation needs from a fresh merge (#3772 point 4).
8. **The stuck process.** Retire pid 81962 and the scratch-clone loop, or repoint it, as part of landing this.

## Finding (2026-09-21): the open policy calls are decision card xki1xap; one FOUND line above is incomplete

Design points 6 (cadence) and 5 (conflict handling), plus the alert path and when a slice may graduate, are filed as decision card xki1xap (uncleared, not yet prepared); settle it before or with this loop. One correction to the FOUND list: `we:scripts/conveyor/branch-sync.mjs` never pushes, but on the prototype branch only, `we:scripts/conveyor/poc-branch-sync.mjs` already builds the merge commit with git plumbing and pushes it plainly (never forced) under `withPocLandLock`, gated on the registry's `autoSync` flag, and the runner calls it each tick. So the resolver of design points 2 to 4 is largely written there and is not on `main`; whether it has ever pushed a real merge live is not verified. Also: the staging ref `origin/lane/mechanical-dispatcher-catchup` is no longer a fast-forward of the branch (12 commits landed after it was cut), and the five judgment forks of that merge are decision card xdqy6xk.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/branch-sync.test.mjs` passes, with new cases on real throwaway git fixtures that fail today: a clean merge is pushed fast-forward only and the remote tip equals the merge commit; a moved remote tip is refused and retried from a fresh fetch, never forced; a conflicting merge pushes nothing, freezes the loop and writes the alert; a branch with `autoSync: false` (or `WE_POC_BRANCH_SYNC=0`) is not touched; and the merge holds `withPocLandLock` so a concurrent fast-land waits.
2. **Observable** — after one live tick, `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` shows zero commits only on main, and no commit on the branch has been rewritten (its old tip is an ancestor of the new one).
