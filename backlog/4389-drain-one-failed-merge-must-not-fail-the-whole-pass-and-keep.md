---
bornAs: xipsrr8
kind: story
size: 2
status: resolved
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-28"
dateResolved: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "445845d1a57de4d8bfc1caddb252bab0fce12aaf"
tags: []
---

# Drain: one failed merge must not fail the whole pass, and keep the gh error text

Live 2026-09-28 9:08 PM ET: the drain pass considered #2879 and #2880; the merge of #2879 failed with only 'Command failed: gh pr merge 2879 ...' (no stderr kept), the pass exited 2, #2880 was never tried, and the daemon backed off 120s. MVP in we:scripts/merge-ai-prs.mjs: catch a per-PR merge failure, record its stderr in failedPrs[].detail, continue with the remaining PRs, and do not treat a single-PR failure as a pass failure for backoff. Must: test with two PRs where the first merge throws; live proof: a pass with one failing merge still lands the other.

## Premise check (against `main` @ 445845d1a)

Half true. The cascade's per-PR `try/catch` (`we:scripts/merge-ai-prs.mjs`, `catch` at 5472) **already continues**: a thrown `mergePr` marks that candidate `skip` (5498), pushes to `failedMerges` (5507), and the loop goes on (`if (!progressed) break`, 5512, fires only when nothing landed). So "#2880 was never tried" is not caused by a missing catch. Likelier causes: #2880 was `blockedBy`/stacked on #2879 (a failed candidate "stays blocking its dependents", comment at 5498), or it was deferred. The "120s backoff" is also a misread: 120s is the normal tick (`DEFAULT_PASS_INTERVAL_MS` in `we:skills-src/conveyor/daemon-manifest.mjs`); `we:skills-src/conveyor/pass-daemon.mjs:182` only logs a non-zero exit and nothing in the repo branches on merge-ai-prs exit 2. So the real harm of exit 2 is a false "pass failed" signal, not a delay. What IS still broken:

1. **Lost error text** — `detail = String(e.message).split('\n')[0]` (line 5473) yields only `Command failed: gh pr merge …`; the `gh` stderr on `e.stderr` is dropped. `ghListErrText` (line 3503) already does the right thing for `pr list`; the merge path never reuses it.
2. **Exit 2 on any failed merge** — lines 5846 and 5953 exit 2 whenever `failedMerges` is non-empty, even when other PRs landed that pass. That exit is what the incident log read as a failed pass.

## Design

- Reuse `ghListErrText(e)` (line 3503) for the merge catch at line 5473, so `failedMerges[].detail` = first line + gh's last stderr line (capped 300 chars). Rename-free: keep the export name, add a one-line doc note that it serves both listing and merge.
- Keep the loop's continue-on-failure exactly as is; pin it with a test rather than change it.
- Exit code: a pass that landed at least one PR (`merged.length > 0`) and had per-PR merge failures exits **0** with `failed` still populated in the JSON (both the one-shot exit at line 5846 and the watch exit at line 5953 use one shared helper `passExitCode({ dup, failed, mergedCount })`). A pass where nothing landed and something failed still exits 2. Duplicate-id stays exit 3, unchanged. `mergedCount` source per site: one-shot (5846) → `result.merged.length` (it destructures no `merged`); watch (5953) → `allMerged.length` (5856), not the last pass's `merged`. Watch's `lastFailed` is last-pass-only (an earlier unretried failure is dropped) — unchanged here, noted in Follow-ups. JSON `ok` keeps meaning "no duplicate ids"; `failed` populated with exit 0 is the intended partial-success signal, documented in the helper's doc comment. A `rebaseDrop === 'rebased'` failure goes to `pendingRebased`, never `failedMerges`, so it already exits 0 (pinned by a test).

## MVP

Musts only:
- Merge-failure `detail` carries gh's stderr cause.
- Shared `passExitCode` helper: partial success is not a pass failure.
- Tests below.

OUT of scope (see Follow-ups): changing how a failed PR's dependents are treated; any daemon/supervisor backoff change.

## Test plan

In `we:scripts/__tests__/merge-ai-prs-merge-failure-isolation.test.mjs` (new), following the fake-`gh`-on-PATH shim of `we:scripts/__tests__/merge-ai-prs-gh-error-exit-code.test.mjs`:
Fixture: the existing gh-error test's shim only answers `pr list` → `[]`, so it cannot reach the merge step. The new test extends it with a fake `gh` that returns two ready, labelled, green, mergeable candidates from `pr list`/`pr view`, answers the revalidation reads, fails the first `pr merge` (exit 1 + stderr `GraphQL: Pull request is not mergeable`), succeeds the second, and — critically — reports `state: OPEN` for the failed PR on `pr view --json state,mergedAt` (else `isPrAlreadyMerged` turns the failure into "confirmed merged" and no `failed` entry exists). If that candidate fixture proves too heavy to drive through the CLI, fall back to source-level assertions (the pattern in `we:scripts/__tests__/merge-ai-prs-merge-trace-post-confirm.test.mjs`) for the catch wiring plus unit tests of the pure helpers, and lean on the Proof plan for the end-to-end run.
1. Source/unit: the merge catch calls `ghListErrText` (a source-level assertion on the catch block) — RED today (it calls `.split('\n')[0]`). The helper's own stderr behavior already works and is not the test.
2. Two-PR CLI run (above fixture): JSON `failed[0].detail` contains `not mergeable` AND `merged` contains the second PR — RED before: detail is the bare `Command failed` line.
3. Same run exits 0 (was 2) — RED before.
4. Both merges fail → exit 2 still. **Guard, green before and after** (stops over-loosening).
5. `passExitCode({dup:[1],failed:[],mergedCount:0})` → 3; dup wins over partial success. RED by absence (import fails before the helper exists); also `({dup:[],failed:[x],mergedCount:1})` → 0 and `({failed:[x],mergedCount:0})` → 2.
6. A `rebaseDrop: 'rebased'` failed merge lands in `pendingRebased` and the pass exits 0 — guard, pins existing behavior.

## Proof plan

- Before/after on the real fake-`gh` CLI run from case 2: capture the JSON + exit code on `main` (bare detail, exit 2) and on the lane (stderr cause in detail, exit 0, second PR merged).
- The fake-`gh` before/after IS the required proof (deterministic, reproducible by the builder). If the candidate fixture is not drivable end to end, a dry run of `we:scripts/merge-ai-prs.mjs` is not sufficient (it never merges) — the builder must then show the catch block exercised through the unit/source tests plus one `passExitCode` table and say plainly that no live merge failure was induced.

## Follow-ups

- Re-run `node we:scripts/verify-lane.mjs` in an environment allowing real `ps` reads. This sandbox denies them; the existing we:scripts/operations/__tests__/restart-runner-io-real.test.mjs and we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs need that capability. No test or gate was weakened.

- Test fixture lesson: isolate the subprocess's `os.homedir()` as well as git/gh; disabling the whole-pass lease alone does not isolate the merge-write lock. Keep temporary shims outside the repo.

- Find what actually happened to #2880 in the 2026-09-28 pass (dependent of #2879? deferred?) — the catch already continues, so the incident's second-PR miss has another cause.
- Decide whether a failed PR should keep blocking its stacked dependents for the pass (comment at 5498) or only its true `blockedBy` edge.
- Watch-mode `lastFailed` keeps only the last pass's failures; an earlier unretried failure is dropped from the final exit/JSON.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/merge-ai-prs-merge-failure-isolation.test.mjs` fails before this item lands and passes after.


## Progress

- 2026-09-30: implemented only the scoped drain change in we:scripts/merge-ai-prs.mjs and its new regression suite we:scripts/__tests__/merge-ai-prs-merge-failure-isolation.test.mjs. The merge catch reuses `ghListErrText`; both exit sites use `passExitCode`, with the watch using cumulative merges. Cascade ordering and rebased-pending behavior remain unchanged.
- **Before:** ran the new suite against the checkout's unmodified implementation at `c4e9f83274d41d7ae0bc3415a152a51feb0c7642` (the available baseline, rather than the card's older prepared SHA). Result: **10 failed, 1 passed**; the both-fail exit-2 guard passed. Actual non-dry-run CLI, fake gh/git: attempts `[2879,2880]`, JSON `merged:[{num:2880,repo:null,headSha:"sha-2880"}]`, `failed:[{num:2879,repo:null,headSha:"sha-2879",detail:"Command failed: gh pr merge 2879 --merge --delete-branch --match-head-commit sha-2879"}]`, `ok:true`, **exit 2**.
- **After:** same CLI fixture and assertions: **11 tests passed**. Attempts `[2879,2880]`, same merged/failed identities and `ok:true`, but detail is `Command failed: gh pr merge 2879 --merge --delete-branch --match-head-commit sha-2879 — gh: GraphQL: Pull request is not mergeable`, **exit 0**. Both failures still attempt both PRs, record two failures, merge none, and exit **2**. No real GitHub merge failure was induced; this is the deterministic fake-gh proof required by the card.
- **Watch/soak guard:** two consecutive real CLI sweeps attempt `[2879,2880,2879]`; the second sweep only fails. Before: cumulative `merged:[2880]`, `lastFailed:[2879]`, exit **2**. After: the same buckets with stderr preserved, exit **0**. The pure table pins duplicate precedence (3 even with partial success), no-land failures (2), partial success (0), and empty passes (0). Executing the production catch's rebased branch records `pendingRebased:[2879]`, no failures, and exit **0** through the helper.
- Reproduce the JSON evidence with `DRAIN_ISOLATION_PROOF=1 npx vitest run we:scripts/__tests__/merge-ai-prs-merge-failure-isolation.test.mjs` (strip the `we:` namespace for a shell path). Temporary shims and state are created outside the repo and removed after each run. The fixture isolates `os.homedir()` for the subprocess's real locks; no production lock bypass was added. The deliberately minimal fixture has no derived-artifact project, so its post-land regeneration reports non-fatal failures; those are separate from merge results.
- **Wider verification:** `node we:scripts/verify-lane.mjs` ran its selected dependency suite: **211 files passed, 2 failed; 10,778 tests passed, 6 failed**. The new 11-test regression suite passed again. All six failures are in the two existing real-process-table suites named in Follow-ups; direct `ps -p $$ -o pid=,ppid=,command=` returned `Operation not permitted` (exit 126). This environment restriction cannot be repaired within this card's scope or the session's permissions; the verification marker remains red, not bypassed. Since verification chains standards after successful tests, `npm run check:standards` was launched separately.
- **Final gates:** the first standards run caught two `exit-wraps-call` violations introduced by nesting the pure helper in `process.exit`. Fixed both sites by computing `exitCode` first, then exiting with the value; no gate suppression. `npm run check:standards` then passed with **0 errors** (4,547 warnings). Re-ran `node we:scripts/verify-lane.mjs` after this fix: **211 files / 10,778 tests passed**, including all **11** new regression tests; the same **2 files / 6 real-process-table tests failed** under the confirmed sandbox restriction. `git diff --check` passed. No shared agent docs or repo helper files were created or edited.
