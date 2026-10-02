---
bornAs: xoo506d
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/health-investigate-plan.mjs", "we:scripts/conveyor/health-investigate-dispatch.mjs", "we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs", "we:scripts/conveyor/__tests__/health-watch-core.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-10-01"
dateResolved: "2026-10-01"
preparedDate: "2026-09-30"
preparedAgainstSha: "235bc9ce646f256e235f00860ab0460c7d450435"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2850's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-investigate-plan.mjs:108` — Keep an entry while its episode is still open (pass open episode ids into pruneLedger), and add a test that an old finished entry for a still-open episode blocks re-dispatch.
2. `we:scripts/conveyor/health-investigate-dispatch.mjs:247` — Annotate the closed-transition episodes with investigationStatus and investigation before the report write, or run the append step after the reports are written. Add an integration test of a tick where findings land and the episode closes in the same tick.
3. `we:scripts/conveyor/health-investigate-dispatch.mjs:77` — In `createInvestigationSinks`, add a permission mode to `extraArgs` (e.g. `dontAsk`/`plan`, if the CLI supports it) when the caller supplies none. Also add a test that fails if the argv lacks a permission-mode flag. If the CLI cannot express that, add a `check:standards` rule that untrusted-input agent kinds must declare a permission mode.
4. `we:scripts/conveyor/health-investigate-dispatch.mjs:222` — Branch on `e.notApplied` in the catch block. Record an indeterminate failure as a `running`-like entry that holds the slot and is reaped by session name. Add a test that injects an UNKNOWN error and asserts the slot stays held.
5. `we:scripts/conveyor/health-watch-core.mjs:563` — Neutralise backtick runs in `scrubInvestigationText`, or fence with a longer delimiter. Ignore `--state-root` in the agent-facing verbs when the settings env already pins it. Add a test that findings containing a fence do not close the report fence.
6. `we:scripts/conveyor/health-investigate-plan.mjs` — Preserve investigation tombstones for active episodes and add a deterministic regression test that prunes the ledger, advances beyond seven days, and replans the same open episode.
7. `we:scripts/conveyor/health-investigate-dispatch.mjs` — Bind recording authority to an enforced per-session capability or isolated writer endpoint, and gate it with a two-session impersonation regression test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2850@9979506d71b0beb8cb5ebd1fe25826fab283e2d8

## Done when

1. **Executable** — `npx vitest run health-investigate-dispatch health-watch-core health-watch` (name filters matching the three scoped test files) — fails before this item lands (the new regression cases in the Test plan are RED) and passes after.

## Progress

- 2026-09-30 prepare pass. Premise check: none of the seven guards is on `main` (`git log --grep=4437|4437` shows only the JIT-numbering commit; every cited code shape is still present). Not already-done.
- Citation drift corrected (goal unchanged): guard 1 `pruneLedger` is `we:scripts/conveyor/health-investigate-plan.mjs:144` (card said `:108`); guard 2 is steps 3–4 of `runInvestigations` at `we:scripts/conveyor/health-investigate-dispatch.mjs:253-268` plus the report write in `we:scripts/conveyor/health-watch.mjs` (card said `:247`); guard 3 `createInvestigationSinks` is `:145-153` (card said `:77`); guard 4 catch block is `:245` (card said `:222`); guard 5 fence is `renderInvestigationSection` at `we:scripts/conveyor/health-watch-core.mjs:574` and `scrubInvestigationText` at `we:scripts/conveyor/health-investigate-plan.mjs:179` (card said line 563).
- Scope corrected: dropped the plan test file (it does not exist — plan tests live in `we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs`); added `we:scripts/conveyor/health-watch.mjs` and `we:scripts/conveyor/__tests__/health-watch.test.mjs` (guard 2's closed-episode report write lives there). Guards 1 and 6 are the same defect (see Design).
- Review round 1 (adversarial subagent) folded in: reap-by-name made a Must with a no-false-reap test; token channel and mint order specified; token-readability residual made explicit with a Read/Grep/Glob deny; `reportedAt` semantics pinned; tick-test seam stated; `dontAsk` smoke added to the proof plan.
- 2026-10-01 built: all seven guards (prune keeps open-episode tombstones; closed-same-tick findings via `closedEpisodes`; default `--permission-mode=dontAsk`; indeterminate dispatch holds the slot and is reaped by name via `claude agents`; `fenceFor` longest-run+1 fences; env-pinned state root beats `--state-root`; per-dispatch sha256 capability token + Read/Grep/Glob scratch deny) with their regression tests in the three scoped test files; the three scoped vitest files pass.

## Design

All seven guards harden the #4078 investigation dispatch.

1. **Ledger prune drops entries of still-open episodes (guards 1 + 6, one fix).** `pruneLedger` (`we:scripts/conveyor/health-investigate-plan.mjs:144-148`) keeps `running` or `now - startedAt < max(window, subjectWindow)` (7 d). A finished entry for an episode still open past 7 d is dropped, then `planInvestigations`' `ONE_PER_EPISODE` check (`entries.find(episodeId)`) stops seeing it and the same open episode is re-dispatched. Fix: `pruneLedger(ledger, { now, config, openEpisodeIds })` also keeps any entry whose `episodeId` is in `openEpisodeIds` (a Set, default empty); `runInvestigations` passes the ids of `state.episodes` (already computed as `openIds`).
2. **Closed-in-the-same-tick episode loses its findings (guard 2).** Step 3 annotates only `state.episodes` (open ones); an episode that closed this tick is only in `result.transitions` (type `closed`). Step 4 appends to the on-disk report if it exists and sets `reportedAt`, then `we:scripts/conveyor/health-watch.mjs` (~`:926-931`) rewrites that report from scratch via `renderEpisodeReport(t.episode)` with no `investigation`, erasing the append. Fix: `runInvestigations` takes `closedEpisodes` (the `t.episode` of each `closed` transition). Step 3 annotates those too. Step 4 skips an entry whose episode is in `closedEpisodes` (the report write will carry the section) and sets `reportedAt` **at the moment the annotation is applied** (so the next tick never appends a duplicate). `we:scripts/conveyor/health-watch.mjs` passes `closedEpisodes` from `result.transitions`.
3. **Permission mode on the untrusted-input agent (guard 3).** `createInvestigationSinks` builds `extraArgs: [...agentArgs, ...healthInvestigateToolArgs(root)]` (`:150`). The installed CLI supports `--permission-mode` (choices `acceptEdits auto bypassPermissions manual dontAsk plan`), so no `check:standards` fallback is needed. Fix: when `agentArgs` has no `--permission-mode` (either `--permission-mode <m>` or `--permission-mode=<m>`), append the one `=`-joined element `--permission-mode=dontAsk` (deny whatever `--allowedTools` does not pre-approve; the read allow-list is already explicit). A caller-supplied mode is respected as-is.
4. **Indeterminate dispatch failure must hold the slot and be reaped honestly (guard 4).** The catch at `:245` records every throw as `dispatch-failed` (terminal, slot freed). The sinks throw `notApplied` (`we:scripts/operations/effect-executor.mjs:69`, `{notApplied: true}`) only when they PROVE nothing started. Fix: `e?.notApplied === true` → keep `dispatch-failed`; otherwise push `{…base, session: sessionSlugFor(episodeId, kind), handle: null, deadlineAt, status: 'running', indeterminate: true, endReason: error}`, so it counts against `investigateMaxRunning` and `planWallClock` reaps it at its clock. **Reap by name is a Must, not a fallback:** `stopSessionWithRetry` only lowercases its argument and runs `claude stop <id>`, and swallows "No job matching" as `alreadyGone` (a success), so stopping an indeterminate entry with its slug could silently mark a still-running agent `stopped-wall-clock`. The stop step (`:225-233`, which today skips when `handle` is null) must, for an entry with no handle, first resolve the handle from `claude agents` by session name; if it resolves, stop that handle; if it finds no such session, the agent provably is not running and the entry may finish; if the lookup itself errors, the entry stays `running` with `lastStopError` (retried next tick).
5. **Findings can break the report markup / redirect the state root (guard 5).** The report renderers in `we:scripts/conveyor/health-watch-core.mjs` (evidence `:574`, diagnosis `:599`, measurements `:593`) use bare triple-backtick fences, and the evidence command is an inline code span (`` `${scrubText(ev.command)}` ``). A backtick run in untrusted text closes them. Fix: a pure helper `fenceFor(text)` returning a fence one backtick longer than the longest run in the text (min 3), used for every fenced block, and the same longest-run+1 delimiter for the inline command span. Second half: `main()` in `we:scripts/conveyor/health-investigate-dispatch.mjs` (`:333`-`:340`) honours `--state-root`, so a prompt-injected agent could point `record`/`show` at another root. Fix: when the session-env pin `CONVEYOR_STATE_ROOT_ENV` is set, ignore `--state-root` (the pinned root wins); the flag stays honoured only when the env is unset (tests, operator CLI).
6. **Recording authority is a guessable string (guard 7).** `recordFindings` authorizes on `entry.session === session`, but the slug is deterministic (`sessionSlugFor(episodeId, kind)`) and printed in the brief, so any agent can claim another's slug. Fix: per-dispatch capability token. ORDER: `runInvestigations` mints `randomBytes(24).toString('hex')`, stores only its sha256 as `tokenHash` on the ledger entry (set before the dispatch call so an indeterminate entry from guard 4 still has it), then calls `dispatch(target, { token })`. CHANNEL: `dispatchInvestigation` builds the sinks per call (`createInvestigationSinks({ root, stateRoot, token })`) and the token rides the session `--settings` env (`WE_HEALTH_INVESTIGATE_TOKEN`) next to the state-root pin, because `resolveSettingsEnv` is otherwise built once and sees only the cwd. `recordFindings` requires the env token (injectable param for tests) and compares sha256 with `timingSafeEqual`; absent or wrong → refused. MIGRATION: a `running` entry with no `tokenHash` (dispatched before this ships) keeps the old session-name check until it finishes, so a deploy does not strand a live investigation. READABILITY (stated, not hidden): the env is also in the session's local settings file and process argv, and the agent's disallow list does not deny `Read`/`Grep`/`Glob`. MUST: add deny rules for those tools over the dispatch session-scratch root (derived from the sink's `sessionCwdFor`, the parent of every session's cwd) so one agent cannot read another's settings. Residual after that: a co-resident process under the same OS user (not a prompt-injected agent) can still read it; the isolated writer endpoint is the real fix and is a Follow-up.

## MVP

Musts only — all seven guards, each with its regression test (guards 1+6 are one fix):
1. `pruneLedger` keeps entries of open episodes.
2. Closed-same-tick findings survive the report write; `reportedAt` set when annotated.
3. Default `--permission-mode=dontAsk` when none supplied.
4. Indeterminate dispatch failure holds the slot; reap resolves the name via `claude agents` and never false-reaps.
5. Longest-run+1 fence/inline delimiter; `--state-root` ignored when env-pinned.
6. Per-session capability token on `record` (minted before dispatch, hash on ledger, env-delivered), legacy-entry migration, Read/Grep/Glob deny on the scratch root.

OUT of scope (Follow-ups): config-driven permission-mode policy beyond honouring caller args; a general markdown-escaping pass over non-fenced report prose; a separate-process/socket writer endpoint; a `check:standards` rule that untrusted-input agent kinds declare a permission mode (only needed if the CLI could not express it — it can).

## Test plan

All in `we:scripts/conveyor/__tests__/` (dispatch test file unless noted), each RED on current `main`:
- **open-episode tombstone** — finished entry, `pruneLedger` at `now + 8 d` with its episode id in `openEpisodeIds`; entry survives and `planInvestigations` holds `one-per-episode`. RED today: entry dropped, episode re-dispatches. Companion: id absent → still pruned.
- **closed-same-tick findings** — (`we:scripts/conveyor/__tests__/health-watch.test.mjs`) `tick()` has no injection seam for dispatch/stop, so seed the ledger with a `running` entry whose `handle` is null (no real `claude stop` runs) and pre-write the findings file, with the episode closing this tick; assert the written report contains `## Agent investigation` and the findings exactly once, `reportedAt` set, and a second tick does not append again. RED today: the rewrite clobbers the append.
- **permission mode default** — `agentArgs: []` → argv has `--permission-mode=dontAsk`; `['--permission-mode','plan']` and `['--permission-mode=plan']` are respected with no second flag. RED today: no flag.
- **indeterminate dispatch** — plain `Error('UNKNOWN')` → entry `running`/`indeterminate` with the deterministic session and a `tokenHash`; `max-running` holds a second candidate; `notApplied` still → `dispatch-failed`. RED today: both free the slot. The existing ENOENT test in the `runInvestigations` block throws a plain Error and must switch to `notApplied`.
- **reap by name, no false reap** — indeterminate entry past its clock: (a) `claude agents` lists the session → `stop` called with the resolved handle, entry `stopped-wall-clock`; (b) `stop` returns `alreadyGone` for a name that the lookup still lists → entry stays `running`; (c) lookup errors → stays `running` with `lastStopError`; (d) lookup finds no session → finishes. RED today: the `if (s.handle)` skip marks it stopped without calling `stop`.
- **fence** — (`we:scripts/conveyor/__tests__/health-watch-core.test.mjs`) evidence output with a triple-backtick line and a command with a backtick; opening fence longer than any run inside, closing matches, inline span delimiter longer than the run. RED today: bare triple fence.
- **pinned state root** — `main(['record','--state-root=/elsewhere',…])` with the env pin set writes under the pinned root. RED today: flag wins.
- **two-session impersonation** — two episodes; B's token, a missing token, and a wrong token recording for A are refused; A's token succeeds once; a legacy running entry with no `tokenHash` still accepts the session-name path. RED today: anyone naming A's slug succeeds.
- **scratch-root read deny** — `healthInvestigateDisallowedTools` contains `Read`/`Grep`/`Glob` rules over the scratch root. RED today: absent.

## Proof plan

Live before/after, each printing a concrete pass criterion:
- **Guard 1/6:** copy the live health state dir's ledger and open-episode ids into a fixture; run old vs new `pruneLedger` at `now + 8 d`. Criterion: before kept=0, after kept=1.
- **Guard 2:** a tick in a throwaway `--state-root` fixture (seeded per the Test plan) with a closing episode and pre-recorded findings; `grep -c 'Agent investigation'` on the written report. Criterion: before 0, after 1.
- **Guard 3:** print the argv `createInvestigationSinks` hands the injected spawner. Criterion: `--permission-mode=dontAsk` absent → present. Plus one `claude -p --permission-mode=dontAsk` smoke with the real allow-list showing `show` and `record` still execute (proves the mode does not break the investigation).
- **Guard 4:** fixture tick with a throwing dispatch. Criterion: ledger status before `dispatch-failed`, after `running`+indeterminate; then a clock-past tick against a stubbed `claude agents` shows the stop by resolved handle.
- **Guard 5:** render a report with a fenced evidence line and a backtick command; Criterion: parses as one code block / one inline span before fails, after passes.
- **Guard 7:** in a fixture, run `record` via the CLI as the wrong session, no token (refused, exit 1) and the right token (recorded, exit 0).
- `npm run check:standards` green.

## Follow-ups

Each a future backlog item (the builder files them):
- Stronger recording endpoint: a separate writer process/socket so even a co-resident same-user process cannot obtain the token.
- General markdown neutralisation of untrusted prose in episode reports beyond the fenced/inline spans.
- Capped retry for `notApplied`-class dispatch failures (#3083 is the existing unruled card — link, do not duplicate).
- Reuse `fenceFor` in any other renderer that fences untrusted text (the filing-request report splice).
