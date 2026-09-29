---
bornAs: xst3fyp
kind: story
size: 1
status: resolved
scope: ["we:scripts/lib/git-hook-surface.mjs", "we:scripts/lib/__tests__/git-hook-surface.test.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# resetHookSurface: delete a worker-created .git/config when the baseline had none

Advisory follow-up from PR #2867 (WE #4291): we:scripts/lib/git-hook-surface.mjs resetHookSurface restores .git/config only when the baseline had one; a .git/config the worker created from nothing survives the reset. MVP: delete it when the baseline recorded none. Must: regression test.

## Design

`resetHookSurface(dir, baseline)` only ever restores `.git/config` when
`baseline?.configBytes != null` (the "baseline had one" branch). When a caller passes an explicit
`baseline` whose `configBytes` is `null`/absent — the pre-worker snapshot recorded no config file on
disk at all — the function today does nothing to `.git/config`, so a config a worker created from
nothing since that snapshot survives the reset untouched. Add a matching branch: when a `baseline` was
explicitly passed (never the no-baseline pre-worker cleanup call, which must keep leaving an existing
repo's own config alone) and it recorded no config, delete `.git/config` if one now exists.

## MVP

- In `we:scripts/lib/git-hook-surface.mjs`'s `resetHookSurface`, add an
  `else if (baseline && baseline.configBytes == null)` branch alongside the existing restore branch
  that deletes `.git/config` (best-effort, `restoreOk = false` on failure, matching the existing
  restore branch's error handling).
- One regression test in `we:scripts/lib/__tests__/git-hook-surface.test.mjs` proving a worker-created
  config is deleted when the baseline recorded none.

## Test plan

New test `resetHookSurface > deletes a worker-created .git/config when the baseline recorded none
(#4393)`: take a `snapshotHookSurface` baseline with `.git/config` already removed (`configBytes ===
null`), have the "worker" write a fresh `.git/config`, call `resetHookSurface(dir, baseline)`, assert
the config file no longer exists and `result.clean === true`. Confirmed RED against the pre-fix code
(failed on `existsSync(...)` being `true`) and GREEN after the fix. A second test — added after the
`/converge` panel/red-team round both surfaced the same carve-out coverage gap — pins the negative
guard: `resetHookSurface(dir)` with **no** baseline at all must leave an existing `.git/config`
untouched. Full existing suite (107 pre-existing + 2 new = 109 tests) passes.

## Proof plan

Live before/after via the admitted `vitest related` wrapper against the touched files
(`we:scripts/lib/git-hook-surface.mjs`, `we:scripts/lib/__tests__/git-hook-surface.test.mjs`):
before the fix, the new test fails with `expected true to be false` on the config-still-exists
assertion; after the fix, all 109 tests in the touch-set pass.

## Follow-ups

None beyond the MVP. The broader out-of-scope surface (`core.fsmonitor`/`clean`/`smudge`/`textconv`
filters, upstream `hook.<name>.command` config-hooks) is already called out as a separate, larger
hardening pass in this file's own header comment — not newly discovered by this fix, so no new card is
filed for it.

## Done when

1. **Executable**:
   ```bash
   node scripts/readiness/heavy-admission.mjs run -- npx vitest related scripts/lib/git-hook-surface.mjs scripts/lib/__tests__/git-hook-surface.test.mjs --run --passWithNoTests
   ```
   fails before this item lands (the new regression test reds) and passes after.
