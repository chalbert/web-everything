---
bornAs: xbz5gr6
kind: story
size: 3
status: resolved
scope: ["we:scripts/codex-direct-task.mjs", "we:scripts/__tests__/codex-direct-task.test.mjs"]
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
tags: []
---

# Codex build/fix jobs run in a sandbox that cannot verify or prove: read-only .git, no network, fixture temp failures

Live 2026-09-30, four detached Codex jobs through we:scripts/codex-direct-task.mjs (`codex exec -s workspace-write`): every one reported that `node we:scripts/verify-lane.mjs` failed with EPERM writing its marker under the lane's .git (Codex workspace-write keeps .git read-only), that check:standards could not create its host admission lock under the lane pool, that soak fixtures failed (ENOTEMPTY / unable to read tree in temp git fixtures), and that no authenticated GitHub read was possible (no network). Result: #4655 (meter the drain) came back as notes only — the job could not reproduce the 90 s soak timeout or take live proof — and every other job reported its gate RED "in this environment", so each PR relies on the outer script's verify. Fix: give build/fix/heal Codex runs the writable roots they legitimately need (the lane's own gitdir, the lane-pool admission root, a per-run temp root) and network for read-only proof, via codex exec config (e.g. `-c sandbox_workspace_write.writable_roots=[…]`, `network_access=true`) or `--add-dir`; keep review/read-only mode unchanged. Proof: rerun #4655 in the new sandbox and show verify-lane writes its marker and the drain soak runs.

## Done when

1. **Executable** — `npx vitest run --testNamePattern="#4665" codex-direct-task` (test source: we:scripts/__tests__/codex-direct-task.test.mjs) verifies the exact edit argv/config, real gitdir, admission override, unique fixture temp directories, and unchanged review permissions.

## Design

Non-review runs keep `workspace-write`, explicitly allow outbound network, and add only the resolved lane gitdir, the shared heavy-admission lock directory, and a unique per-run temp directory. Reuse the admission path resolver from we:scripts/readiness/heavy-admission.mjs. Resolve the gitdir even with a custom log, including linked worktrees; use it for the last-message artifact too. Pass TMPDIR/TMP/TEMP to both the Codex process and its shell config so fixtures use the granted root. Retain temporary fixtures for debugging/resume alongside the persistent session; operators may remove the recorded temp root after finishing the run. Review runs allocate no temp root and receive no new sandbox or network overrides. Network permission enables read-only proof but is not an HTTP-method restriction; existing no-commit/push/PR instructions remain.

## Follow-ups

Live proof after merge must rerun #4655 through we:scripts/codex-direct-task.mjs from an unrestricted host launcher. The delegated child itself must run we:scripts/verify-lane.mjs, write a fresh green we:.git/.lane-verify marker, acquire/release the shared admission lock, execute the drain soak with temp Git fixtures, and perform an authenticated read-only GitHub query. Preserve the child JSONL commands/results and marker, and distinguish a real soak failure from sandbox denial. An outer verifier alone is not proof. This checkout's already-created sandbox cannot gain permissions from these edits.


## Verification

- All 90 tests in we:scripts/__tests__/codex-direct-task.test.mjs passed.
- Installed `codex-cli 0.155.1`: `codex exec --help` confirms `-s`, `-c`, and `--add-dir`. Its real `features list` config loader accepts the generated network/writable-root/temp-shell overrides (including quoted and backslash-containing paths); negative controls reject a string network boolean and numeric writable roots. This proves parsing, not effective child permissions. Config keys match the [official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
- The required verifier was run: we:scripts/verify-lane.mjs selected 16 targets but failed before tests with EPERM writing its marker under we:.git. `npm run check:standards` likewise failed acquiring the host admission lock. These are observed limits of this already-running sandbox, not passing gates. The verifier's selected test command and the underlying standards checker are also run directly for diagnostic coverage.

- Direct execution of the verifier-selected test command: 108 files passed, 2 failed; 6,363 tests passed, 2 failed, 8 skipped. Failures: we:scripts/operations/__tests__/http-adapter.test.mjs (localhost listen EPERM, also confirmed by a standalone socket probe) and we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs (null transcript path; repeated alone, with a separate write probe confirming EPERM at the default home-directory transcript destination). Neither test nor its gate was weakened; neither file is in this card's implementation scope.
- The underlying checker, we:scripts/check-standards.mjs, passed with 0 errors (4,546 warnings). The admission-wrapped command remains blocked in this session.
- Resolved using the requested operation in we:scripts/operations/run.mjs with `resolve --ref=4665`; no commit, push, or PR was made.
