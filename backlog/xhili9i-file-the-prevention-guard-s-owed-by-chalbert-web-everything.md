---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/atomic-json-file.mjs", "we:scripts/lib/__tests__/atomic-json-file.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2738's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2738's review to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/lib/atomic-json-file.mjs:189` — A deterministic guard: before restoring, re-verify `lockPath` is still absent (e.g. re-attempt `openSync(lockPath, 'wx')` as an existence probe, or use a link+unlink no-clobber primitive) and treat 'someone else already claimed it' as a normal retry-acquire path rather than blindly renaming over whatever is there; longer-term, a concurrency fuzz test that hammers withFileLock with many real concurrent acquirers around the stale boundary would surface this whole class of restore/clobber races structurally rather than one hand-picked interleaving at a time.
2. `we:scripts/lib/atomic-json-file.mjs:190` — Add a regression test that races a third acquirer into the steal→restore sub-window (needs a second test seam, e.g. an `onBeforeRestore` hook analogous to the existing `onBeforeStaleTakeover`), and guard the restore rename with an existence/content check that fails loudly or retries instead of silently overwriting.
3. `we:scripts/lib/atomic-json-file.mjs:75` — Add a check that the resolved realpath stays under an expected root (or matches expected ownership) before writing through it, or explicitly document/accept the risk in a backlog card given this tool's single-user threat model.
4. `we:scripts/lib/atomic-json-file.mjs:118` — Add a hard age ceiling that force-reclaims a lock regardless of pid liveness (mirroring the belt-and-suspenders ceiling pattern this same PR already uses in we:scripts/conveyor/session-reaper.mjs's path B), plus a backlog note for the pid-reuse case since it isn't practically reproducible in a deterministic unit test.
5. `we:scripts/lib/atomic-json-file.mjs:174` — Add a deterministic concurrency regression test that pauses takeover after the rename and attempts acquisition by a third caller while the displaced holder remains active; gate changes on mutual exclusion throughout this schedule.
6. `we:scripts/lib/__tests__/atomic-json-file.test.mjs:162` — Add an aged-lock/current-PID regression test asserting timeout without entering the callback, and verify that removing PID protection makes that test fail.
7. `we:scripts/lib/atomic-json-file.mjs` — A PR-level patch coverage gate (e.g., Codecov patch status) requiring 100% coverage on new/changed logic lines, ensuring new branches like `kill(pid, 0)` are executed by tests, rather than relying on the 80% global floor.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
