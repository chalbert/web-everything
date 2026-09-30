---
bornAs: xipsrr8
kind: story
size: 2
status: open
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-28"
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

- Find what actually happened to #2880 in the 2026-09-28 pass (dependent of #2879? deferred?) — the catch already continues, so the incident's second-PR miss has another cause.
- Decide whether a failed PR should keep blocking its stacked dependents for the pass (comment at 5498) or only its true `blockedBy` edge.
- Watch-mode `lastFailed` keeps only the last pass's failures; an earlier unretried failure is dropped from the final exit/JSON.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/merge-ai-prs-merge-failure-isolation.test.mjs` fails before this item lands and passes after.
