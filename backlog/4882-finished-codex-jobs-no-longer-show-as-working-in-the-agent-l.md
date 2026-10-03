---
bornAs: xp7yr8z
kind: story
size: 2
status: resolved
scope: ["we:scripts/operations/agent-activity.mjs", "we:scripts/operations/agent-activity-io.mjs", "we:scripts/operations/__tests__/agent-activity.test.mjs", "we:scripts/operations/__tests__/agent-activity-io-real.test.mjs"]
dateOpened: "2026-10-03"
dateResolved: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# Finished Codex jobs no longer show as working in the agent listing

Live 2026-10-03: the WIP feed returned 622 job rows of which about 8 were live; about 30 finished Codex jobs read as working because of an ordering bug in how job rows are merged, and claude agents still lists 15 sessions as working that are 17-30 days old. Fix the row ordering so a job's latest terminal state wins, and age out sessions with no transcript activity. Files: the agent-activity producer under we:scripts/operations/ (find the job-row merge), with a test replaying a finished job followed by an older running row.

## Progress

### Implementation and observed proof — 2026-10-03

- Implemented the two pure rules, shared six-hour constant, one-pass rollout lookup, completion read with fail-soft handling, and background/subagent filtering within the four declared files. No session or thread records were deleted.
- **Regression before:** on the unchanged checkout implementation (HEAD `e3bd114d639301b792532cca44a03a74d349cadc`), the two scoped Vitest files reported **9 failed / 46 passed**. All nine new cases failed: missing pure helpers, absent rollout fields, finished Codex emitted, and stale background emitted.
- **Regression after:** the same command, `npx vitest run we:scripts/operations/__tests__/agent-activity.test.mjs we:scripts/operations/__tests__/agent-activity-io-real.test.mjs` (checkout-relative paths), passed **55/55**. The terminal-state session regression is unchanged. Coverage includes equality, newer re-dispatch, fresh rollout versus old start, invalid/missing completion, unknown timestamps, pid exemptions, and the strict six-hour boundary.
- **Repeated-read proof:** both real reader regression fixtures repeat 20 times. Completed jobs never reappear; a newer re-dispatch and missing/corrupt/invalid completion cases remain; stale parents and their subagents stay absent while fresh and pid-bearing parents retain their children.
- **Live before**, primary checkout reader at approximately 17:32–17:36 UTC: **31 Codex / 10 background** rows. The live-work collector/assessor reported **31 Codex working / 10 background running / 0 background working** (the old background rows were already classified idle-too-long downstream). This differs from the preparation snapshot's 12 background rows; no fresh pid-bearing background session was listed during this probe.
- **Live after**, lane code reading the same primary root and host transcript state: **0 Codex / 0 background** rows; live-work reported **0 Codex working / 0 background running**. Explicitly supplying the primary root avoids falsely proving the fix against the lane's empty thread directory. The stale background names were conveyor-3436, conveyor-3464z, prepare-2768, conveyor-3484, conveyor-3481b, conveyor-3554b, conveyor-2416b, fix-2003, fix-2115, and fix-2267.
- **CLI proof:** primary output was `{"codexWorking":31,"staleBackground":10}`; lane output was `{"codexWorking":0,"staleBackground":0}`, matching the ten observed background run IDs. Ran `node we:scripts/operations/run.mjs live-work --json` in the lane. Primary CLI invocation required the canonical checkout path (the alias bypasses its main-module guard) and a lane-local `OPERATION_RUNS_DIR`, because this sandbox cannot write operation receipts in the primary checkout. Collector proof above reads primary state without mutating it.
- **Standards:** `npm run check:standards` passed with **0 errors** (5,275 repository warnings). `git diff --check` passed.
- **Lane gate:** `node we:scripts/verify-lane.mjs` ran 71 test files: **3,097 passed / 1 failed**. The sole failure is the out-of-scope missing-transcript fixture described in Follow-ups; the gate remains red pending scope approval and fixture clock correction.
- Proof is recorded here instead of a PR body because this job explicitly prohibits opening a PR.


Premise checked against main on 2026-10-03.

- **Old premise:** an ordering bug in how job rows are merged lets an older running row beat a newer terminal one.
- **Corrected premise:** there is no ordering step to fix. Codex rows never consult any terminal signal at all.
  - `we:scripts/operations/agent-activity-io.mjs:190` (`codexThreadRows`) turns EVERY file in `we:.operations/codex-delivery-threads/` into a row with `state: null`, no `pid`, and no `transcriptPath`.
  - Those files are written by `we:scripts/operations/codex-delivery-provider.mjs:419` (`writeCodexThreadId`) and are never deleted.
  - Downstream, `we:scripts/operations/live-work.mjs:61` (`classifyRunState`) has no pid and no last-activity time for such a row, so it falls through to `'working'` at line 80.
  - Live evidence: the primary checkout holds 31 thread records, dated 2026-09-13 to 2026-09-19. That is the "about 30 finished Codex jobs". Only 1 of the 31 slugs has a completion record in `we:.operations/completions/` (`fix-2115`, still `started`).
- **Old premise:** `claude agents` lists 15 stale sessions as working.
- **Corrected count:** a live `claude agents --json` read on 2026-10-03 returned 12 `working` background rows. 11 of them have no `pid` and a transcript last written 2026-09-03 to 2026-09-16 (17 to 30 days old). The only fresh one, `fix-3507`, carries a pid.
  - `we:scripts/operations/agent-activity-io.mjs:239` (`TERMINAL_STATES`) only drops rows the CLI itself marks `done`/`failed`/`stopped` (line 265). Nothing ages out a row the CLI still calls `working`.
- **Scope:** was only `we:scripts/operations/agent-activity.mjs`. The rows are built in `we:scripts/operations/agent-activity-io.mjs`, so that file and both existing test files are added.
- **Overlap note:** open card 4765 also edits `we:scripts/operations/agent-activity-io.mjs` (it exports `TERMINAL_STATES`). The two edits touch different functions.

## Design

Two pure rules in `we:scripts/operations/agent-activity.mjs`, applied by the reader in `we:scripts/operations/agent-activity-io.mjs`. Dropping rows in the reader fixes every consumer at once (`agent-activity`, `live-work`, `live-state`, `item-activity`), with no change to them.

**Rule 1 — latest terminal state wins for a Codex row.**
- New pure `codexRowIsTerminal(row, completion)` in `we:scripts/operations/agent-activity.mjs`.
- Returns `true` only when `completion?.status === 'done'` AND `Date.parse(completion.updatedAt) >= row.startedAt`.
- `row.startedAt` is the thread record's own `at`, already parsed at `we:scripts/operations/agent-activity-io.mjs:202`.
- So a finished job followed by an OLDER thread record is terminal. A thread record NEWER than the done completion (a re-dispatch under the same slug) stays live. A `started` completion, a missing one, or an unparseable timestamp is never terminal.
- The reader reads the completion with `tryReadCompletion(slug, completionsDir)` from `we:scripts/operations/completion-store.mjs`. Wrap it in try/catch. An invalid slug or a corrupt record means "no completion", which keeps the row.

**Rule 2 — age out rows with no recent activity.**
- New pure `isAgedOut(row, { now, staleMs = STALE_ROW_MS })`, plus exported `STALE_ROW_MS = 6 * 3600_000`.
- 6 hours is not a new policy. It reuses the cutoff `RECENT_MS` already applies to interactive rows at `we:scripts/operations/agent-activity-io.mjs:208`, which itself matches `we:scripts/dev/active-progress-watch.mjs`. Move the constant into the pure file and have `RECENT_MS` read it, so there is one value.
- Applies only to `kind: 'background'` and `kind: 'codex'` rows. Review jobs, subagents and interactive rows are never aged out here. Review jobs are already pid-pruned; interactive rows already have their own 6h sweep.
- A row with an integer `pid` is never aged out. Its liveness is the pid probe in `we:scripts/operations/live-work-io.mjs`, which marks a dead pid as `dead`.
- Activity time is the newest finite value of `row.lastActivityMs` and `row.startedAt` (number, or a parseable string). If neither is finite, return `false`. Unknown is not stale.
- Returns `now - activity > staleMs`.

**Reader changes in `createAgentActivityReader`:**
- New injectable options `completionsDir` (default `resolveCompletionsDir()`) and `codexHome` (default `resolveCodexHome()` from `we:scripts/codex-direct-task.mjs`). That module is import-safe: its CLI body sits behind `isMain` at line 990.
- Background rows: set `lastActivityMs` to the transcript's mtime (`statSync`, null when missing). Skip the row, and its subagents, when `isAgedOut` is true.
- `codexThreadRows(root, { codexHome })`: walk the Codex sessions directory ONCE into a `threadId → path` map. Rollout files end in `-<threadId>.jsonl`, the same match `findRolloutFile` uses at `we:scripts/codex-direct-task.mjs:367`. Stamp `transcriptPath` with the rollout path (or null) and `lastActivityMs` with its mtime. One walk, not one per thread: 749 rollout files exist on this host today.
- Codex rows: skip when `codexRowIsTerminal(row, completion)` or `isAgedOut(row, { now: now() })`.
- Setting `transcriptPath` on Codex rows also lets `live-work` show a real last-activity time for a live Codex run, instead of a blind `working`.

Rejected alternative: sorting or de-duplicating rows by time. There is only ever one thread record per slug (the file name is the slug), so there is nothing to order.

## MVP

1. In `we:scripts/operations/agent-activity.mjs`: add and export `STALE_ROW_MS`, `isAgedOut`, `codexRowIsTerminal` as specified above.
2. In `we:scripts/operations/agent-activity-io.mjs`: `RECENT_MS` reads `STALE_ROW_MS`; add the one-pass rollout index and stamp `transcriptPath`/`lastActivityMs` in `codexThreadRows`; add `completionsDir`/`codexHome` options and apply both rules in `createAgentActivityReader`; stamp `lastActivityMs` on background rows and skip aged-out ones. Add one line each to the file header's SOURCES list.
3. Tests as listed below. Update the existing exact-shape assertion in the `codexThreadRows reads REAL …` test for the two new fields.

## Test plan

Both files run under Vitest (they import from `vitest`).

`we:scripts/operations/__tests__/agent-activity.test.mjs` — new `describe('stale and terminal rows')`:
- `codexRowIsTerminal: a done completion newer than the thread record wins (finished job, then an older running row)` → `true`.
- `codexRowIsTerminal: a thread record newer than the done completion stays live (re-dispatch)` → `false`.
- `codexRowIsTerminal: a started, missing, or unparseable completion is never terminal` → `false` for each.
- `isAgedOut: a no-pid background row quiet for 17 days is aged out` → `true`.
- `isAgedOut: a no-pid codex row with a fresh rollout mtime but an old startedAt is kept` → `false` (newest time wins).
- `isAgedOut: never ages out a row with a pid, a review-job, a subagent, an interactive row, or a row with no activity time` → `false` for each.

`we:scripts/operations/__tests__/agent-activity-io-real.test.mjs` (real temp dirs via `withRealRepo`):
- `codexThreadRows stamps transcriptPath and lastActivityMs from a REAL rollout file under codexHome/sessions`. A thread with no rollout gets `transcriptPath: null`.
- `createAgentActivityReader drops a finished Codex job — a done completion replayed after an older thread record`. Fixture: a thread record for slug `conveyor-9101` with `at` = T1, and a completion record for the same slug with `status: 'done'` and `updatedAt` = T2 > T1. Also slug `conveyor-9102`, whose thread `at` is newer than its done completion and which has a fresh rollout. Expect `conveyor-9101` absent and `conveyor-9102` present.
- `createAgentActivityReader ages out a no-pid background session whose transcript is 17 days old, keeps a fresh one and a pid-carrying one`. Injected `listAgents` returns three `working` rows; real transcript files get `utimesSync` mtimes; `now` is injected.
- The existing `drops terminal-state sessions` test must still pass unchanged.

## Proof plan

Live case: the 31 Codex thread records and the 11 stale `claude agents` rows on this host.

- **Before (on main):** from the primary checkout, call `createAgentActivityReader()({})` from `we:scripts/operations/agent-activity-io.mjs` in a one-line `node -e` script. Count rows with `kind: 'codex'` and `kind: 'background'`. Expect about 31 and 12.
- Also run `node we:scripts/operations/run.mjs live-work` (path resolved to the checkout). Count `running` rows in state `working` whose name is a Codex slug or one of the 11 stale names.
- **After (on the lane):** run the same two reads with the lane's code against the same host state. Expect 0 codex rows (every record is older than 6h with no fresh rollout) and 1 background row (`fix-3507`, or whatever is live then). The stale names must be gone from the `live-work` running list.
- Record both outputs in the PR body. Do not delete any thread record or session by hand; the code must do the filtering.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/agent-activity.test.mjs we:scripts/operations/__tests__/agent-activity-io-real.test.mjs` passes (paths resolved to the checkout). The new cases in `we:scripts/operations/__tests__/agent-activity.test.mjs` and `we:scripts/operations/__tests__/agent-activity-io-real.test.mjs` fail on main (the helpers are missing and the reader keeps every row) and pass after the change.
2. A Codex row whose slug has a `done` completion newer than its thread record is not emitted by `createAgentActivityReader`. A thread record newer than that completion is still emitted.
3. A `background` or `codex` row with no pid and no activity in the last 6 hours is not emitted. Rows with a pid, review jobs, subagents and interactive rows are unaffected by this rule.
4. There is one 6-hour constant: `RECENT_MS` and `isAgedOut` both read `STALE_ROW_MS`.
5. The live before/after counts from the Proof plan are in the PR body.

## Follow-ups

- Verification exposed a clock-dependent fixture in `we:scripts/operations/__tests__/item-activity-io-real.test.mjs`: its missing-transcript case uses an October 2 start with the real clock. Under the specified age rule it expires once six hours pass. Its intended missing-evidence assertions require an injected clock near the fixture start; permission to extend scope for that fixture was requested rather than weakening the age rule or its assertions.

- Codex delivery runs almost never write a completion record (1 of 31 today). Rule 1 will rarely fire until they do; Rule 2 carries the live case. Making the Codex delivery wrapper write a `done` completion is a separate card.
- The Codex thread-record directory is never pruned. A sweep that removes records past a retention window could follow; it is not needed for the listing to be correct.
- The card's "622 job rows" figure was not reproduced from WE code. If a Plateau-side feed (`plateau-app:src/wip/progress-read.ts`) merges job rows on its own, check it after this lands.
