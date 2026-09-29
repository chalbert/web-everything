---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/daemon-jobs-runtime.mjs", "we:scripts/lib/daemon-job-snapshots.mjs", "we:scripts/lib/__tests__/daemon-jobs-runtime.test.mjs", "we:scripts/lib/__tests__/daemon-job-snapshots.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2848's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/daemon-jobs-runtime.mjs:152` — A lint or standards rule that rejects execFileSync/spawnSync in modules reachable from a tick loop. Failing that, a unit test that asserts launchJob's snapshot step is async or off-thread.
2. `we:scripts/lib/daemon-job-snapshots.mjs:140` — An integration test that runs several ticks across N distinct codeShas and asserts the snapshot count stays bounded. A dead-export check for exported functions used only by tests would also catch this.
3. `we:scripts/lib/daemon-job-snapshots.mjs:66` — Use `set -o pipefail` (bash) or run git archive to a temp tar file and then extract it. Additionally assert the extracted tree is non-empty, or check that `git cat-file -e <sha>^{commit}` succeeds before archiving. Add a test that passes an unknown sha to ensureCodeSnapshot and expects a throw and no `code/<sha>` dir. A lint rule banning `| ` in `sh -c` strings passed to execFileSync could catch the class.
4. `we:scripts/lib/daemon-jobs-runtime.mjs:285` — Add a deterministic interleaving test that refreshes the second job's heartbeat while the first stop promise is pending and asserts that the second handle is never stopped.
5. `we:scripts/lib/daemon-jobs-runtime.mjs:177` — Add a subprocess integration test using a nonexistent worktree directory that asserts the daemon survives, records the launch failure, and continues processing ticks.
6. `we:scripts/lib/daemon-job-snapshots.mjs:137` — A lint rule ensuring exported side-effect cleanup functions are either used within the package or explicitly bound to a cron/GC trigger.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2848@4d34c9fad792f8931e69b4abae695f0a17db4c38

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
