---
bornAs: xx9swng
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/queue-store.mjs", "we:scripts/conveyor/__tests__/queue-store.test.mjs"]
dateOpened: "2026-09-27"
preparedDate: "2026-09-30"
preparedAgainstSha: "107aeae93c8f83232346b4beaf8c7d6917d8e642"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2816's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/queue-store.mjs` — Publish migration with atomic create-if-absent semantics and add a deterministic test that creates a modified canonical queue between the initial existence check and publication, asserting that migration preserves it.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2816@d338d13d77fd3d1f95a2e8c5c598dd1dbf1226b8

## Premise check

Still real on current `main`. `migrateLegacyQueue` (`we:scripts/conveyor/queue-store.mjs:275`) checks `existsSync(path)` at line 277, reads legacy files, then calls `writeQueueFile(queue, path)` at line 286. `writeQueueFile` (line 313) writes a temp file and `renameSync`s it onto `path`, and `rename` silently OVERWRITES. So if a writer (a `we:scripts/conveyor/queue.mjs add`/clear-for-build, or a concurrent `migrate`) creates or modifies the canonical queue between the check and the publish, the migration replaces it with the stale legacy union. That loses live entries and can resurrect ones the operator removed, which the function's own doc comment (line 268-270) promises never happens. No test covers the window: the existing migrate test (`we:scripts/conveyor/__tests__/queue-store.test.mjs:272`) only re-runs migrate AFTER it finished. No later commit touched this (`git log` on the file ends at `b538fbeb9`). Scope is accurate: both files are the only ones the fix touches.

## Design

Publish the migrated queue with atomic create-if-absent instead of check-then-rename.

- Add `writeQueueFileIfAbsent(queue, path)` next to `writeQueueFile` in `we:scripts/conveyor/queue-store.mjs`. It writes the same temp file (same `mkdirSync` + `${path}.${pid}.${ts}.tmp` naming), then publishes with `linkSync(tmp, path)`. `link` fails with `EEXIST` if `path` exists and never overwrites; it is atomic, and the destination appears fully written (readers never see partial JSON, same guarantee as the rename). The temp file is `unlinkSync`ed in a `finally`. Returns `true` if it published, `false` on `EEXIST`. On `EPERM`/`ENOTSUP`/`EXDEV` (no hard-link support) it falls back to the old `renameSync` publish behind a fresh `existsSync`, so migrate never becomes a hard failure there; any other error rethrows. `linkSync` is the standard Node/POSIX create-if-absent primitive (no `renameSync` no-replace flag exists in Node); the state home is a local disk directory, so hard links are available.
- `migrateLegacyQueue` keeps its early `existsSync` fast path (cheap, common case) but the non-dry-run publish becomes `writeQueueFileIfAbsent`. If it returns `false`, the canonical file won the race: return `{ migrated: false, reason: 'canonical-exists', path, from: [], count: readQueueFile(path).length, queue: [] }`, the exact shape the fast path already returns. No other caller changes.
- Test seam: add an optional `hooks` field to `migrateLegacyQueue`'s existing options object (`{ env, root, dryRun, hooks = {} }`); `hooks.beforePublish?.(path)` is invoked synchronously after the legacy union is built and immediately before the publish. Production callers (`we:scripts/conveyor/queue.mjs:159`, others) pass nothing.
- `writeQueueFile` itself is unchanged: ordinary `add`/`remove` are read-modify-write and intentionally last-write-wins (its doc comment, line 309-312). Only the one-time migration needs create-if-absent.

## MVP

Musts only:
1. `writeQueueFileIfAbsent` with `link`-based create-if-absent, temp cleanup, `EEXIST` → `false`.
2. `migrateLegacyQueue` uses it and reports `canonical-exists` when it loses the race, leaving the winner's file byte-identical.
3. The `hooks.beforePublish` seam and the deterministic race test below.

Deliberately OUT (see Follow-ups): making every `writeQueueFile` caller race-safe (needs a lock or compare-and-swap; a design change), a fully race-free publish on no-hardlink filesystems (the fallback keeps the old, narrower window), cross-process (multi-real-process) stress test.

## Test plan

All in `we:scripts/conveyor/__tests__/queue-store.test.mjs`, in the existing "one-time migration" describe using its `world()` fixture:
1. **migration preserves a canonical queue created inside the window.** Call `migrateLegacyQueue({ env, root, hooks: { beforePublish: () => writeQueueFile([{ num: '7', addedAt: 'T9' }], w.canonical) } })`. Assert `reason: 'canonical-exists'`, `migrated: false`, and the canonical's raw bytes (`readFileSync`) are byte-identical to what the hook wrote (not the legacy `3604`/`42`). RED before the change because the `hooks` option is unknown, so the race never fires and migrate reports `migrated: true`; the true overwrite is shown by the Proof plan's seam-only step.
2. **canonical with a removed entry.** The hook writes a canonical holding only `7` (legacy's `42` absent on purpose); assert `42` is NOT resurrected and `3604` is not added. Same RED reason.
3. **migrate: `writeQueueFileIfAbsent` unit** (name contains "migrat" so the Done-when filter selects it; add the export to the test's import list). First call returns `true` and writes; second call with different content returns `false` and leaves the first file's bytes untouched; no `.tmp` files are left in the directory in either case. RED: the function does not exist.
4. **no regression:** the existing migrate tests (copy, idempotent, no-legacy, dry-run) stay green unchanged.

## Proof plan

- Before/after on the real function, no mocks: land the `hooks.beforePublish` seam first WITHOUT the fix (old `writeQueueFile` publish) and run test 1: it goes RED with the canonical overwritten by the legacy union (the real defect); then apply the fix and rerun green.
- Live CLI probe (sequential idempotency only; the race itself is proven by the test): unset `CONVEYOR_STATE_ROOT`/`CONVEYOR_QUEUE_FILE`/`CONVEYOR_NO_LEGACY_QUEUE`, set `WE_DAEMON_STATE_DIR=<tmp>`, and place a legacy `we:.conveyor/queue.json` where `legacyQueuePaths` resolves (else it reports `no-legacy`), `node we:scripts/conveyor/queue.mjs migrate --json` twice; first reports `migrated`, second `canonical-exists`, and `ls` of the state dir shows no `.tmp` leftovers.

## Follow-ups

- Make the ordinary `add`/`remove` writers race-safe (lock or compare-and-swap) so concurrent adds no longer last-write-wins.
- A multi-process (real `child_process`) stress test of `migrate` vs `add`.
- Fallback for filesystems without hard links, if the state home is ever moved onto one.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/queue-store.test.mjs -t "migrat"` fails before the change (canonical queue overwritten, missing `writeQueueFileIfAbsent`) and passes after.
