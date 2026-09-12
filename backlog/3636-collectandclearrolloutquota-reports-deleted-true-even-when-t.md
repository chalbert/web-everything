---
bornAs: xq7vaf7
kind: task
parent: "3635"
status: open
scope: ["we:scripts/codex-direct-task.mjs", "we:scripts/__tests__/codex-direct-task.test.mjs"]
dateOpened: "2026-09-12"
tags: []
---

# collectAndClearRolloutQuota reports deleted:true even when the rollout removal throws

we:scripts/codex-direct-task.mjs line 469 returns `deleted: true` unconditionally once a rollout file was found, but the actual removal at line 467 is wrapped in a bare `try { removeFileFn(rolloutFile); } catch {}` inside a `finally` — so an rmSync that throws (EPERM/EACCES/EBUSY/EISDIR; ENOENT is already swallowed by `force: true`) leaves the file on disk while the return value claims it was cleared. The lie propagates: `codexDirectTask` sets `quotaRolloutCleared = Boolean(lookup.deleted)` and the CLI prints '— rollout file cleared after read', so an operator who opted into `--clear-rollout-after-run` is told the session transcript was removed when it was not. That flag exists precisely so a caller with no `codex exec resume` need leaves nothing behind, which is the guarantee this breaks. The existing test at we:scripts/__tests__/codex-direct-task.test.mjs ('a removeFileFn that itself throws does not propagate — best-effort cleanup') covers the exact path but only asserts `.not.toThrow()`, never `deleted` — the assertion gap is why it shipped. Fix: track a boolean set inside the `finally`'s inner try and return that. Found by a re-review of the already-merged PR #2122 (#3635's implementation), whose original review lenses saw a degraded empty diff; triaged non-blocking because `collectAndClearRolloutQuota` has no in-repo caller except the opt-in `clearRolloutAfterRun` flag, default false.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/codex-direct-task.test.mjs`, with the existing
   `'a removeFileFn that itself throws does not propagate — best-effort cleanup'` case in
   we:scripts/__tests__/codex-direct-task.test.mjs extended to assert `result.deleted === false`
   (and a sibling case keeping `deleted === true` on a removal that succeeds). Red before the fix, green after.
2. `collectAndClearRolloutQuota` in we:scripts/codex-direct-task.mjs returns `deleted: false` when
   `removeFileFn` throws, so `codexDirectTask`'s `quotaRolloutCleared` and the CLI's
   `"— rollout file cleared after read"` line only ever claim a deletion that actually happened.
