---
bornAs: xzdo6ux
kind: story
size: 3
tier: pinned
status: resolved
preparedDate: "2026-09-29"
preparedAgainstSha: "7bb08a40c95e45d23866e2211f8ead4d2d3be59c"
scope: ["we:scripts/lib/daemon-boot-smoke.mjs", "we:scripts/lib/daemon-boot-watchdog.mjs", "we:scripts/lib/daemon-live-smoke.mjs", "we:scripts/lib/daemon-last-good.mjs", "we:scripts/conveyor/soak/breaks/daemon-entry-boot-crash.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# Daemon rebuild smoke boots the daemon entry, and a boot crash rolls back to last-good by itself

Live 2026-09-29 ~10:45 AM ET: overlay PR #2921 introduced an ESM circular-import TDZ (ReferenceError: Cannot access 'DELIVER_ITEM_RUN_SCRIPT' before initialization in we:scripts/operations/dispatch-provider-registry.mjs). The rebuild's live smoke passed and adopted the tree, then the build daemon crash-looped at startup: the rollback logic lives inside the daemon process that can no longer start, so it could never roll itself back. The builder was down until the operator removed the overlay and ran we:scripts/lib/daemon-load-overlay.mjs by hand (labelled emergency). MVP: (1) the rebuild smoke (we:scripts/lib/daemon-rebuild.mjs live-smoke set) imports/boots each daemon's actual entry module in a child process on the candidate tree and rejects the candidate on a boot error; (2) a supervisor-side guard: when a daemon exits within N seconds of start K times in a row after a rebuild, revert the clone to daemon-last-good (we:scripts/lib/daemon-last-good.mjs) before the next start, without the daemon's own code. Must: tests; soak break reproducing today's boot crash, RED before / GREEN after; live proof via a deliberately broken overlay on a scratch clone.

## Design

Two independent, additive layers, neither touching `we:scripts/lib/daemon-rebuild.mjs`'s own 2400-line state
machine:

1. **Boot smoke** — a new `SMOKE_CHECKS` row in `we:scripts/lib/daemon-live-smoke.mjs` that spawns ONE CHILD
   PER standalone daemon entry module (the six under `we:skills-src/conveyor/`), each dynamically `import()`ing
   just that one entry against the candidate tree, in parallel. Every entry gates its own CLI body behind an
   `IS_CLI`/`import.meta.url` guard, so a plain `import()` from a harness script never runs `main()` — only
   the module's own top-level code (imports, top-level `const`s) executes, which is exactly what crashed live
   in #2921 (an ESM circular-import TDZ evaluated at import time, before any entry's own body ran). One child
   per entry, not one shared child for all six, is deliberate: Node's ESM module cache is process-lifetime, so
   a shared child could let an EARLIER entry's successful import of some common module silently mask a LATER
   entry's own TDZ in that same module (a real gap a review round caught in an earlier draft).
2. **Boot watchdog** — a standalone module (`we:scripts/lib/daemon-boot-watchdog.mjs`) with a pure
   `decideCrashLoop` (K consecutive fast exits under an N-second survival window) and an IO shell
   (`runSupervisedStart`) that spawns the real entry, races its exit against the survival window, and — once
   the guard trips — reverts the clone via the existing `rollbackToSha` BEFORE the next start attempt. It
   tracks its own BOOT-CONFIRMED sha (stamped only once a spawned entry survives the window), distinct from
   the smoke's merely-adopted sha, because #2921's whole failure mode was a build the smoke wrongly treated as
   safe. Deliberately NOT wired into any real launchd/daemon launch path by this item (mechanism only, same
   scoping as `we:skills-src/conveyor/daemon-manifest.mjs`'s own "mechanism only" item) — the operator's
   constraint on this item is never to restart or re-supervise a REAL running daemon, so the real wiring is a
   separate follow-up (below) proven against one real daemon's own clone, not built blind here.

## MVP (Musts only)

- `checkDaemonEntriesBoot` (`we:scripts/lib/daemon-boot-smoke.mjs`) + its `daemon-entries-boot` row in
  `we:scripts/lib/daemon-live-smoke.mjs`'s `SMOKE_CHECKS`.
- `decideCrashLoop` + `runSupervisedStart` (`we:scripts/lib/daemon-boot-watchdog.mjs`), proven only against a
  scratch clone.
- The soak break (`we:scripts/conveyor/soak/breaks/daemon-entry-boot-crash.mjs`) reproducing #2921's exact
  failure shape.
- Everything else (real launchd wiring, tuned N/K from observed real boot times) is explicitly OUT of this
  MVP — filed as a follow-up, not half-built here.

## Test plan

- `we:scripts/lib/__tests__/daemon-boot-smoke.test.mjs` — injected-`runChild` unit coverage of
  `checkDaemonEntriesBoot`'s own contract, plus a REAL subprocess test that reproduces the exact #2921 ESM
  circular-import TDZ with a hand-built fixture pair, and a REAL-tree wiring test that boots all six production
  entries clean today. Every one of these fails before `we:scripts/lib/daemon-boot-smoke.mjs` exists (the
  import itself throws `Cannot find module`) and passes after.
- `we:scripts/lib/__tests__/daemon-boot-watchdog.test.mjs` — pure `decideCrashLoop` edge cases (fewer than K
  attempts, a slow attempt clearing the streak, more attempts than K) plus a real-fs state round-trip.
- `we:scripts/lib/__tests__/daemon-boot-watchdog-live.test.mjs` — see Proof plan.
- `we:scripts/lib/__tests__/daemon-live-smoke.test.mjs` — every pre-existing fixture updated for the new
  `daemon-entries-boot` row (skip-unchanged counts, a shaped stub reply for its own `node --input-type=module`
  child) — every pre-existing case plus the new ones pass.

## Proof plan

Live, before/after, never against a real daemon:
- `we:scripts/lib/__tests__/daemon-boot-smoke.test.mjs`'s TDZ fixture test: RED is the live #2921
  `ReferenceError` shape, reproduced with a genuine two-file ESM circular import — proven by hand before
  `checkDaemonEntriesBoot` existed (the import throws `Cannot find module`) and after (it reports `ok:false`
  naming the entry and the exact error).
- `we:scripts/lib/__tests__/daemon-boot-watchdog-live.test.mjs`: a REAL scratch git clone, a REAL "good" commit,
  then a REAL "deliberately broken overlay" commit whose entry throws on every start — three real supervised
  starts each exit fast, the fourth reverts the scratch clone's real `HEAD` (verified via `git rev-parse`) back
  to the last boot-confirmed commit before spawning anything else, and a fifth start on the reverted clone
  survives again (the self-heal, proven, not asserted from a mock).
- `we:scripts/conveyor/soak/breaks/daemon-entry-boot-crash.mjs`: RED (fix absent — the check module does not
  even import) / GREEN (fix present — `checkDaemonEntriesBoot` catches the fixture) proven by hand before
  committing (temporarily removed the new file, ran the break, restored it, ran it again).

## Follow-ups

- Filed: wire the boot watchdog into a real daemon's actual launch config (choose real N/K from observed real
  boot times, prove it live on one real daemon's own dedicated clone) — `we:backlog/4509-wire-the-4468-daemon-boot-crash-loop-supervisor-into-a-real.md`, `blockedBy: 4468`.

## Done when

1. **Executable** — `npx vitest run` against `we:scripts/lib/__tests__/daemon-boot-smoke.test.mjs` (drop the
   `we:` citation prefix to actually run it — it fails before this item lands, since the module does not
   exist, and passes after; its own `checkDaemonEntriesBoot` catches a real ESM circular-import TDZ fixture
   reproducing the #2921 failure shape).
2. **Registered in the live smoke** — `we:scripts/lib/daemon-live-smoke.mjs`'s `SMOKE_CHECKS` carries a
   `daemon-entries-boot` row that dynamically imports every standalone daemon entry module on the candidate
   tree and fails the whole smoke on any boot error.
3. **Crash-loop guard** — `npx vitest run` against `we:scripts/lib/__tests__/daemon-boot-watchdog-live.test.mjs`
   (drop the `we:` prefix to run it) proves, on a real scratch git clone with a real deliberately-broken
   overlay commit (never a real daemon), that three consecutive fast exits trip a `git reset --hard` back to
   the last BOOT-CONFIRMED (not merely smoke-adopted) commit before the next start, and that the clone
   self-heals on the next attempt.
4. **Soak break** — `we:scripts/conveyor/soak/breaks/daemon-entry-boot-crash.mjs` reproduces the live #2921
   failure shape (RED without the fix, GREEN with it — proven by hand; `fixPresent` reads GREEN on this tree).

## Progress

- Part 1 (`we:scripts/lib/daemon-boot-smoke.mjs`): a new `daemon-entries-boot` check appended to
  `SMOKE_CHECKS`, right before the always-last `tree-stays-clean` row. Spawns ONE CHILD PER entry in
  `DAEMON_ENTRY_MODULES` — the six standalone conveyor daemon entry points under `we:skills-src/conveyor/` —
  in parallel, against the candidate tree, never invoking any entry's own `main()` (each entry's
  `IS_CLI`/`import.meta.url` guard reads false when imported by a harness script). One child per entry, never
  one shared child, so no entry's import can be masked by an earlier entry having already warmed the same
  module into Node's process-lifetime ESM cache. Verified live against the real repo tree (all six boot clean
  today), against a genuine ESM-circular-import-TDZ fixture (catches it, naming the entry and the exact
  `ReferenceError`), and end-to-end through `runLiveSmoke` itself (a real broken entry fails the WHOLE smoke,
  classified `'code'`, never `'transient'`).
- Part 2 (`we:scripts/lib/daemon-boot-watchdog.mjs`): a pure `decideCrashLoop` (K consecutive fast exits
  under an N-second survival window) plus an IO shell (`runSupervisedStart`) that spawns the real entry, races
  its exit against the survival window, stamps a BOOT-CONFIRMED sha (distinct from the smoke's
  merely-adopted sha) on survival, and reverts via the existing `we:scripts/lib/daemon-live-smoke.mjs`'s
  `rollbackToSha` BEFORE the next start once the guard trips. Deliberately NOT wired into any real launchd
  config by this change (mechanism only, same scoping as `we:skills-src/conveyor/daemon-manifest.mjs`) —
  proven live only against a scratch clone; a real-daemon rewiring follow-up is filed separately.
- `scope:` corrected above — the real touch-set never reached `we:scripts/lib/daemon-rebuild.mjs` (the two new
  files integrate through `we:scripts/lib/daemon-live-smoke.mjs` and `we:scripts/lib/daemon-last-good.mjs`'s
  own exported primitives instead).
