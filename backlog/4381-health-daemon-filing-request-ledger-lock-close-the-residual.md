---
bornAs: xbedfjd
kind: story
size: 2
parent: "4075"
status: open
blockedBy: ["4079"]
scope: ["we:scripts/conveyor/health-file-request.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "3bc43906fdc5b16f5b14a6aa867692174ec66904"
tags: [health-daemon]
---

# Health daemon filing-request ledger lock: close the residual check-then-act stale-reclaim race

#4079's we:scripts/conveyor/health-file-request.mjs#withLedgerLock reclaims a stale lock via an atomic renameSync keyed to a FIXED path (lockPath), not the specific inode/mtime a waiter actually inspected as stale. Two waiters can still both observe a lock as stale and race: the loser's rename can target a lock a THIRD process legitimately just (re)created, not the one it inspected, in the narrow window between the stale-check stat and the rename. This is bounded (a live holder's own lock is only stale after staleMs=60s, far longer than the tiny read-modify-write the lock actually guards) and accepted as a known residual for #4079's MVP rather than solved with heavier machinery.

Fix properly: add a generation/token check so a reclaim only succeeds if the file's content still matches what was inspected (read+verify content before renaming, or a proper compare-and-swap lock primitive).

## Done when

1. **Executable** — a test drives two concurrent reclaimers plus a THIRD process that recreates the lock inside the window between one reclaimer's stale-check and its rename, and proves only the process holding the content/generation-matched lock ever enters the critical section (the other reclaimer's rename must be refused, not silently succeed against the wrong lock).
2. **No regression** — the existing `withLedgerLock` single-winner and mutual-exclusion tests in `we:scripts/conveyor/__tests__/health-file-request.test.mjs` still pass unchanged.

## Premise check

Verified against current `main` (3bc43906f): `withLedgerLock` at `we:scripts/conveyor/health-file-request.mjs:252-285` still stats `lockPath` (line 263) then `renameSync(lockPath, claimPath)` (line 268) by the FIXED path, with no content check — the residual is real and unfixed. No commit graduates this item (`git log --grep=4381` shows only its JIT-number drop). Blocker #4079 is resolved. `scope:` (one file) is accurate; the test file `we:scripts/conveyor/__tests__/health-file-request.test.mjs` is the test-only companion.

## Design

Replace check-then-act with a true **generation compare-and-swap built on `wx` create** — no step ever removes a lock by path, and there is no window where "the lock" is absent-then-restored (review round 1 killed the rename-away/restore design: the gap lets a fourth acquirer enter, and a reclaim mutex adds a crash/deadlock surface without closing it).

Lock state is a set of monotonic generation files `<filingDir>/ledger.lock.<gen>` (zero-padded). The highest gen is "current".
1. **Observe**: list gens; `cur` = highest (0 if none). Read `cur`'s mtime AND content from ONE open fd (`openSync`+`fstatSync`+`readSync`), so mtime and content describe the same file. Content is `held:<pid>` or `released`.
2. **Free/stale test**: `cur` is takeable if it is `released`, absent (gen 0), or `held` with age > `staleMs`.
3. **Take = CAS**: `writeFileSync(<gen cur+1>, 'held:<pid>', {flag:'wx'})`. Only ONE process can ever create gen `cur+1`; a third process that recreated the lock inside our observe→create window necessarily created that same name, so our `wx` fails `EEXIST` → loop back to observe (sleep/retry). This is the generation check: the swap only succeeds if the current generation is still the one we inspected.
4. **After winning**: best-effort unlink every gen < ours (pruning; ENOENT ignored).
5. **Release**: open our own gen file with flag `r+` (never creates) and overwrite it with `released`; the file stays as a tombstone so the name `cur+1` can never be re-created by a waiter holding a stale observation. A holder whose gen was pruned/superseded gets ENOENT or writes to an old gen — harmless, never touches a successor.
6. Test seam: optional 4th arg `hooks: { afterObserve }` called between step 1 and step 3; production passes nothing.

Legacy `ledger.lock` (bare-pid file from the old scheme) is treated as gen 0 candidate: if present and stale it is unlinked once; if fresh, waited on. Doc comment above the function (lines 227-251) is rewritten to describe the CAS; the "known residual" paragraph and its `#4381` pointer are deleted. Known limit, documented: mtime-based staleness can still reclaim a live holder that runs past `staleMs` — unchanged and out of scope.

## MVP

Musts: generation files with `wx` CAS take; fd-consistent observe; tombstone release; prune; legacy-lock handling; `afterObserve` seam; doc rewrite; the new tests. OUT of scope: kernel locks (`flock`/`O_EXLOCK`), moving off mtime staleness / heartbeat leases, a reclaim mutex (dropped — redundant under the CAS).

## Test plan

In `we:scripts/conveyor/__tests__/health-file-request.test.mjs` (existing withLedgerLock tests stay unchanged and green):
- **third-process recreate inside the window (in-process, deterministic)** — plant a stale current gen; `afterObserve` (asserted to have fired, via a flag) creates gen+1 as a fresh `held` lock; assert the reclaimer's `fn` does NOT run before that lock is released, that its `wx` refusal is observed (`timeoutMs` kept far below the planted lock's `staleMs`), and the fresh lock file is untouched. RED on current code because the 4th arg is ignored/hook never fires, so the test's fired-assertion fails; and once the hook is wired into a legacy-shaped body the rename steals the fresh lock and `fn` runs.
- **two reclaimers + third recreator** — same seam driven across two `withLedgerLock` calls sharing one stale lock, each with an `afterObserve` that lets the third recreate; a shared in-memory occupancy counter must never exceed 1. Deterministic, not a real-process race (the real-process test at line 294 stays as an unchanged smoke test).
- **tombstone/CAS name safety** — after release, a waiter holding a stale observation of the old gen tries `wx` on `gen+1`: must get `EEXIST` (tombstone), not enter. RED on current code (no gen files exist).
- **superseded holder release is harmless** — holder A is reclaimed (stale) by B; A's release must not modify B's gen file nor throw.
- **legacy bare `ledger.lock`** — a stale legacy lock is reclaimed once; a fresh legacy lock is waited on.

## Proof plan

Live before/after with a standalone `node` script that imports the real `withLedgerLock` and injects the window WITHOUT the seam, by monkeypatching `fs.statSync` (via `node:module` createRequire'd `fs`) to plant a fresh lock right after the stale stat — works on `main` (which has no seam) and on the lane. Expected output: on `main`, `fn entered: 2 (occupancy peaked at 2)` — the fresh lock was stolen; on the lane, `fn entered: 1 (occupancy peaked at 1)` with the CAS refusal logged. Paste both outputs in the PR body. Then run the `we:scripts/conveyor/__tests__/health-file-request.test.mjs` vitest file green.

## Follow-ups

- Replace mtime-staleness with a heartbeat/lease so a slow-but-alive holder is never reclaimed (separate, larger design).
- Extract `withLedgerLock` into a shared lock helper; `we:scripts/operations/review-extra-seats.mjs:746` carries a sibling copy with the same shape.
