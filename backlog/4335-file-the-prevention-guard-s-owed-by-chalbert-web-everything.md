---
bornAs: xx5zpnb
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/daemon-overlay.mjs", "we:scripts/lib/__tests__/daemon-rebuild.test.mjs", "we:scripts/lib/daemon-rebuild.mjs", "we:scripts/__tests__/daemon-overlay.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "d93337a59ecc23f1f799806f89eb5ec0e41eac12"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2827's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/daemon-overlay.mjs` — Add a deterministic stale-recovery concurrency test that pauses between ownership inspection, rename, and restoration, and asserts exclusive entry with three contenders; use a locking protocol that preserves exclusivity during recovery.
2. `we:scripts/lib/__tests__/daemon-rebuild.test.mjs` — Extend the named test with staged and unstaged sentinel changes and compare index bytes and working-tree contents before and after the preview; require it in the targeted test gate.
3. `we:scripts/lib/daemon-rebuild.mjs:2211` — A unit test in `we:scripts/lib/__tests__/daemon-rebuild.test.mjs` exercising `previewOverlayConflict` against a rename/delete conflict to verify the exact parsed file names.
4. `we:scripts/lib/daemon-rebuild.mjs:2307` — A unit test where `main` advances with a file modification AFTER an existing overlay branches, and a candidate overlay conflicts with `main` on that file.
5. `we:scripts/daemon-overlay.mjs:155` — A concurrency test for `withAddGuardLock` specifically targeting the PID write window, or using filesystem timestamps (`birthtimeMs`) instead of file contents to verify lock identity.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2827@f2b81fc50e0fdcf38411f5612c5658431f0af069

## Premise check

All five guards still apply on current `main` (cited line numbers have drifted; real ones below). `we:scripts/__tests__/daemon-overlay.test.mjs:201` has only a two-process real-race test, no deterministic interleaving of `withAddGuardLock`'s stale recovery (`we:scripts/daemon-overlay.mjs:154-165`), and that function is not exported. The "never mutates the clone" test (`we:scripts/lib/__tests__/daemon-rebuild.test.mjs:1186`) compares only `HEAD` + `for-each-ref` + the overlay list — no staged/unstaged sentinel, no index bytes. No test advances `main` after an existing overlay branched, then conflicts a candidate on that file (the fold at `we:scripts/lib/daemon-rebuild.mjs:2298`).

Two of the guards uncover REAL defects, confirmed by the adversarial review:
- **Guard 1 (lock race).** Waiter A sees dead owner D; B breaks it and takes a fresh lock; A renames B's live lock aside (`we:scripts/daemon-overlay.mjs:157`); before A restores it (line 161) a third waiter C's `mkdirSync(lockDir)` succeeds — B and C both inside `fn()`. A related, pre-existing hole: when the owner reads `''` (`we:scripts/daemon-overlay.mjs:138`), a FRESH holder between `mkdir` and its owner write reads the same `''` as a crashed one, so the line-160 identity check (`'' === ''`) passes and its live lock is removed.
- **Guard 3 (parser bug, not test-only).** For a rename-with-edit vs delete conflict, real `git merge-tree --write-tree` prints stage lines for the renamed path plus `CONFLICT (rename/delete): a renamed to b in <oid>, but deleted in HEAD.` and `CONFLICT (modify/delete): … Version <oid> of b left in tree.` The greedy message regex in `we:scripts/lib/daemon-rebuild.mjs:2213` (`.* in (\S.*)$`) takes the LAST ` in `, yielding bogus names (`HEAD.`, `tree.`) alongside the real one. So `check.files` is wrong today: the guard-3 test is RED and needs a small production parser fix.

Guards 2 and 4 are pure test debt: `previewOverlayConflict` only reads `root` and works in a scratch bare repo (`we:scripts/lib/daemon-rebuild.mjs:2262-2281`).

## Design

**Order of work (gives every lock test a true RED baseline).** Commit 1 = seam only: export `withAddGuardLock` and add `hooks` (below) to the OLD protocol, no behaviour change. Write the lock tests; show them RED against commit 1. Commit 2 = the protocol fix; tests go GREEN.

**Hooks seam.** `withAddGuardLock(root, env, fn, hooks = {})` (`we:scripts/daemon-overlay.mjs:142`); production callers pass nothing. `hooks.onPhase?.(phase, ctx)` (awaited): `attempt` (each loop iteration, before `mkdir`, so a test can hold contender C at a chosen attempt), `inspected` (after the gone-owner check, before any removal), `removing` (immediately before the removal/rename), `removed` (after). In the OLD flow `removing` fires before the rename-aside and `removed` after the restore/rm.

**Protocol fix (guards 1 + 5).**
- Owner file holds a unique token `<pid>:<randomUUID>`; liveness parses the prefix before `:` (a legacy bare-pid owner must still parse). Written with a temp-file + `renameSync` into `owner` so a reader never sees a partial token; the owner-less window is then only "dir exists, `owner` not yet renamed in".
- Recovery is serialised behind a second `mkdir` mutex `<lockDir>.recover`. While the dead lock dir exists, `mkdirSync(lockDir)` fails for everyone, so exclusivity is never released mid-recovery (this replaces the rename-aside/restore dance). The recoverer records `{token, ino, mtimeMs}` of `lockDir` at `inspected`, and under `.recover` re-stats; it removes `lockDir` (rename to a unique aside, then `rmSync`) ONLY if token, inode and mtime are all unchanged. Owner-less dirs are removed only when their mtime is > 5s old AND unchanged — never when fresh.
- `.recover` break rule: a `.recover` dir older than 30s (mtime) may be broken by renaming it aside and re-taking it, and every subsequent recoverer step is guarded by the same token+inode+mtime re-check, so a paused-then-resumed old recoverer finds `lockDir` changed and does nothing. Residual hazard, named and accepted: a recoverer paused between its re-check and its rename for > 30s AND a replacement lock landing in that gap could still be removed; a truly atomic compare-and-remove needs a real lock primitive (Follow-ups).
- Release removes `lockDir` only when the owner token equals ours (full token). Non-goals, named: pid reuse / foreign pid namespaces (pre-existing; bounded by the 10-minute stale limit), and the check-then-`rmSync` gap in release (reachable only after a 10-minute stale break).
- Rejected: `birthtimeMs` identity (guard 5's alternative) — TOCTOU between stat and rename, not portable.

**Guard 3 parser fix.** In `parseMergeTreeConflictFiles` (`we:scripts/lib/daemon-rebuild.mjs:2208`) make the stage-line source authoritative: when ANY stage line exists, return only those paths and skip the message regex; use the regex only as a fallback when no stage lines are present (and anchor it non-greedily to the documented `CONFLICT (kind): … in <path>` shape). Update the header comment, which already calls the stage lines "the more reliable source".

**Tests only (guards 2, 4).**
2. Extend the "never mutates" test (`we:scripts/lib/__tests__/daemon-rebuild.test.mjs:1186`) — or add a sibling with a unique name — with a staged file, an unstaged tracked edit and an untracked sentinel in `cloneDir`; snapshot raw `.git/index` bytes and each file's contents before and after the preview; assert identical.
4. Register `lane/existing` (touches only an unrelated fixture file), capture the OLD main sha, `advanceMain` modifying a shared fixture file, then `pushBranch(candidate, …, { base: oldMainSha })` editing that shared file; assert `clean:false`, `files` = just the shared file, `conflicting` = `[]`.

**Targeted gate.** No config file lists these test files (checked the root package manifest, the scripts JSON configs, vitest config, `.github`); the gate for this item is the Done-when command, and the new tests carry unique name fragments so its `-t` filter always selects them.

## MVP

Musts only:
1. Seam commit: export `withAddGuardLock` + `hooks`, old protocol unchanged.
2. Protocol fix: token owner, atomic owner write, `.recover` mutex, token+inode+mtime re-check, full-token release; all existing `we:scripts/__tests__/daemon-overlay.test.mjs` cases still pass.
3. Parser fix for guard 3 (stage lines authoritative).
4. Tests for guards 1–5 as in Test plan.

Out of scope (Follow-ups): a true atomic compare-and-remove lock primitive; cross-host/NFS semantics; configurable stale limits; sha256-repo stage-line regex.

## Test plan

- `withAddGuardLock — three contenders stay exclusive through a paused stale recovery` (`we:scripts/__tests__/daemon-overlay.test.mjs`, in-process; dead-pid lock pre-created) — A paused at `inspected`; B released, takes the lock and holds it inside `fn`; A resumed to `removing`; C held at `attempt` then released exactly while A is between removal steps; a shared counter tracks concurrent `fn` entries; assert max concurrency 1 and all three eventually run. RED on commit 1 (old protocol: max concurrency 2, or B's lock orphaned).
- `withAddGuardLock — a fresh owner-less lock is never broken` — pre-create bare `lockDir` (mtime now); a contender with a short `WE_DAEMON_OVERLAY_ADD_GUARD_WAIT_MS` throws "still held"; then backdate mtime > 5s with `utimesSync` → contender recovers. Also the collision: contender A inspects an owner-less dir, B (holder) writes its owner, A must not remove it. RED on commit 1 for the collision (`'' === ''` passes today); the plain fresh-lock half is a regression guard.
- `withAddGuardLock — release removes only our own token` — two in-process holders share a pid; A's lock is made stale by backdating its mtime > 10 minutes with `utimesSync` (the pid is live, so age is the only stale path), B breaks and re-takes it, A's `finally` must not remove B's. RED on commit 1 (bare-pid compare).
- `withAddGuardLock — a stale .recover mutex is broken and a resumed old recoverer does nothing` — backdate `.recover` > 30s, second recoverer proceeds; first, resumed, finds token/mtime changed and leaves the new lock. RED on commit 1 (no `.recover`).
- `previewOverlayConflict never mutates staged, unstaged or untracked state` — NON-RED today; mutation-proved with a sabotage that really mutates `cloneDir` (run `git add -A` and `git checkout -- .` against `root` inside the preview), confirmed RED, then reverted.
- `previewOverlayConflict reports exact file names for a rename/delete conflict` — RED today (`check.files` includes `HEAD.`/`tree.`); GREEN after the parser fix; asserts `files` equals exactly the renamed path.
- `previewOverlayConflict conflicts with main advanced after an existing overlay branched, attributing to no overlay` — NON-RED today; mutation-proved by making the fold start from the overlay's base instead of `main`.

## Proof plan

Live on the real modules, before/after: (1) paste the pass output of the Done-when command; (2) guard 1 before/after — run the lock tests on the seam-only commit (RED, concurrency 2 / owner-less collision removed) then on the fix commit (GREEN, concurrency 1); (3) guard 3 before/after — run the real `git merge-tree --write-tree` rename/delete scenario through `previewOverlayConflict` in the lane and print `check.files` (bogus names) before the parser fix and the clean list after; (4) mutation proofs for guards 2 and 4, each shown RED under its named sabotage and GREEN restored; (5) a real `node we:scripts/daemon-overlay.mjs add --check` against a temp clone whose lock dir is owner-less and fresh, showing it waits/refuses instead of breaking it, before vs after.

## Follow-ups

- A truly atomic compare-and-remove lock primitive (retires the `.recover` residual hazard).
- Cross-host / network-filesystem semantics for the `mkdir` mutex.
- Make `ADD_GUARD_STALE_MS` and the `.recover` stale limit env-configurable.
- Extract a shared, tested `mkdir`-mutex helper and migrate other lock sites in `scripts/`.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/daemon-overlay.test.mjs we:scripts/lib/__tests__/daemon-rebuild.test.mjs -t "withAddGuardLock|staged, unstaged or untracked|rename/delete|advanced after an existing overlay"` fails before the change (missing export, RED lock tests, RED rename/delete names) and passes after.
