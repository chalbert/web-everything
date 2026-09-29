---
bornAs: x5s8b47
kind: story
size: 5
tier: pinned
status: resolved
scope: ["we:scripts/operations/review-pr.mjs", "we:scripts/operations/review-job.mjs", "we:scripts/operations/review-extra-seats.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
graduatedTo: "b93d13e29 (+ 466605269 follow-up), PR #2883"
tags: []
---

# review-pr judgeAdvisory crashes silently when Codex is quota-exhausted, permanently stalling advisory review

The core (mandatory-when-opted-in) `judgeAdvisory` seat in `we:scripts/operations/review-pr.mjs` (`providerName: 'codex'`, #3704) spawns a real `codex` CLI process with no quota/availability check at all. `we:scripts/operations/review-extra-seats.mjs#quotaHold` (line 164) already reads Codex's own quota gauge and gracefully skips/logs ("skipping codex — quota gauge at N% on its last seat call; sitting out until <reset>") for its OWN, separate bonus-seat path — but `judgeAdvisory` never calls it. When Codex is exhausted, the spawn fails, and nothing in the job's step-execution wrapper (`we:scripts/operations/review-job.mjs`) catches the failure cleanly: the whole `review-loop-cli` process crashes (exit 1), its real error is lost (only a stray Node deprecation-warning line survives into the completion record's `label`), and `review-pr`'s run record is left permanently suspended at `pending:{step:'judgeAdvisory', stepIndex:3}` — never resumed, because a fresh dispatch (`we:scripts/operations/review-job.mjs`, the #2848 job-model core) always starts a brand-new run from `read` (stepIndex 0) with a new UUID, never revisiting the orphaned one.

## Measured, live (2026-09-28, ~7:07–7:29 PM ET)

- `we:scripts/operations/review-extra-seats.mjs`'s own log line (chalbert/web-everything#2867, 10:39/10:50 PM) confirms Codex's quota gauge was at 99% and the provider was benched: "skipping codex — quota gauge at 99% on its last seat call; sitting out until 2026-10-03T17:11:11.000Z".
- The seat-reservation ledger (`we:.claude/daemon-self-sync-state/conveyor-state/.conveyor/review-seat-reservations.json`) recorded zero new `codex` reservations after 22:28:26 ET — over an hour before, and through the whole window of, every crash below.
- PR #2865's own job log (`we:.operations/review-jobs/review-2865.log`) and completion record (`we:.operations/completions/review-2865.json`) show its FIRST dispatch (pid 2601, 23:06:56) never even reached the loop — a separate, transient lane-pool contention ("no lane within 60000ms ... a different acquire's shared acquirability scan was still running") deferred it (`deferred-no-lane`), which also hit #2867/#2871/#2872 in the same ~1-minute dispatch batch. Its SECOND dispatch (pid 74142, 23:24:32) DID acquire a lane and ran the real loop — the actual run record is `we:.operations/runs/review-pr-79eb6a80-c951-4cd7-97a6-da47d1337df6.json` — completing `read`, `judge` (Sonnet/correctness), `judgeSecurity` (Sonnet/security), then crashing 3 seconds into `judgeAdvisory` (Codex/simplicity), classified only as generic `blocked-on-infra` with no real error text preserved.
- At the moment of filing, the LATEST run record for each of #2865, #2867, #2873, #2874, #2875 (chalbert/web-everything) is independently suspended at the identical `pending:{step:'judgeAdvisory', request.providerName:'codex'}` — a fresh redispatch batch launched by the daemon during this investigation (new live pids) was already heading toward the same wall on all of them, since Codex's sit-out window runs until 2026-10-03T17:11:11Z.
- One coincidental red herring worth recording so a future investigator doesn't repeat the detour: `we:.operations/runs/review-pr-18dd1e43-041d-4d4d-a4f8-7f476fa4a9b3.json` LOOKED like PR #2865's suspended run (same "last written ~7:07 PM", same `pending:{step:'judgeAdvisory'}` shape) but its `input.pr` is actually 2875 — a different, legitimate PR whose OWN filed backlog-card body happens to mention "PR #2865" in prose. The per-PR job log/completion record under `we:.operations/review-jobs/` and `we:.operations/completions/` (keyed by PR number, not a random run UUID) is the reliable source for "what actually happened to PR N", not grepping run-record UUIDs for a PR number that may appear only in quoted prose.

## Answers to the standing questions

1. **Why did the job exit with `judgeAdvisory` pending?** Codex is quota-exhausted (measured above) and the mandatory-when-opted-in `judgeAdvisory` seat has no graceful-skip path for that, unlike the bonus extra-seats path. Not a seat-reservation cap (#2817) — no reservation is even attempted. Not a daemon-restart kill — the job's own process ran ~83s and exited on its own (exit 1), never via a `stopped`/SIGTERM session-reap entry.
2. **Why doesn't the daemon re-dispatch/resume?** It DOES re-dispatch (confirmed live: #2865 was redispatched 3 times across this investigation, most recently seconds before filing). The job model has no "resume a suspended judge" path at all — every dispatch restarts `review-pr` from `read`. What makes this look permanently stuck from the PR's labels is that every retry crashes at the identical step before ever reaching `reduce`/the write-verdict/post-comment steps, so no `advisory:*` label or comment is ever produced no matter how many times it retries.
3. **How many PRs are in the same state?** At minimum 5, live, right now: chalbert/web-everything #2865, #2867, #2873, #2874, #2875 — all independently confirmed suspended at `judgeAdvisory`/codex, all being actively (and futilely) redispatched.

## Full design

Give the core `judgeAdvisory` step (`we:scripts/operations/review-pr.mjs`, the `...(codexAdvisory ? {judgeAdvisory: judgeStep({...})} : {})` seat) the same quota-awareness `we:scripts/operations/review-extra-seats.mjs#quotaHold` already has, instead of spawning Codex unconditionally:

- Before building the `judgeAdvisory` request, call `quotaHold` (or a shared helper extracted from it, if the seat-record shape it reads differs) against the same seat-reservation ledger the extra-seats path already reads. When Codex is currently on a quota hold, do NOT attempt the spawn — treat the run exactly as if `codexAdvisory` had been passed `false` for this seat only (the mandatory Sonnet seats `judge`/`judgeSecurity` still run and still reduce to a real verdict), and record a structured `findings.judgeAdvisory: {skipped: 'codex-quota-exhausted', sitOutUntil: <ISO ts>}` marker so a reader (the posted comment, a future run, a human) can see the advisory seat was intentionally sat out for capacity, not silently lost to a crash.
- Separately, close the observability gap that made this incident expensive to diagnose: whatever step-execution wrapper `we:scripts/operations/review-job.mjs` uses to run a `judgeStep` should catch the step's own thrown error/rejection and persist its REAL message into the completion record's `label` (and the run record, if the crash happens before a run file exists) — not let the process die uncaught with only a stray `punycode` deprecation-warning line surviving as if it were the explanation. This is genuinely a different, narrower defect than the quota-skip above (a good step could still throw for other reasons and the same swallowing would hide it), but it is what turned "check one file" into "read three subsystems and a seat-reservation ledger" for this investigation, and belongs in the same MVP because both land in the same file/step.

## Explicit MVP cut

MVP = (a) `we:scripts/operations/review-pr.mjs`'s `judgeAdvisory` seat checks Codex's quota-hold state (reusing `we:scripts/operations/review-extra-seats.mjs#quotaHold`'s existing logic/data source) before spawning, and skips gracefully with the structured marker described above when Codex is on hold, so the panel still reduces to a real verdict off its mandatory seats; (b) `we:scripts/operations/review-job.mjs`'s step-failure path captures and persists a step's real thrown error text into the completion record's `label` instead of only whatever stray stdout survives. Unit tests: one proving a `codexAdvisory: true` run with a stubbed quota-hold completes with `judgeAdvisory` skipped and an unaffected mandatory-seat verdict (exercising the identical reduce path the `codexAdvisory: false` case already uses); one proving `we:scripts/operations/review-job.mjs` persists a thrown step error's real message.

NOT MVP-blocking (filed as natural follow-ons, not solved here): applying the same quota-check to the other opt-in Codex/agy seats (`judgeCorrectnessAdvisory`, `judgeAntigravityReview`) — same shape, not observed crashing today, lower urgency; the daemon surfacing/escalating a PR whose run keeps re-suspending at the identical step across N consecutive dispatches (a monitoring nicety once the crash itself stops recurring); and the separate ~16-minute lane-pool-contention retry-delay anomaly observed on PRs #2865/#2871/#2872's FIRST (pre-quota-crash) dispatch attempt — real, measured, but its exact cause was not conclusively pinned in this investigation (candidates seen: concurrent `daemon-rebuild`/self-sync "tick-in-progress" contention, heavy `session-reap` passes competing for the same lane-pool scan lock) and deserves its own targeted look rather than a guess folded into this fix.

## Done when

1. **Executable** — re-run the `review-pr` operation (`--codexAdvisory` on) against a PR while Codex's seat-reservation ledger shows a live quota-hold (or a fake ledger in a unit test): the run reaches `reduce`/write with `judgeAdvisory` recorded as skipped, not suspended, and the daemon posts the panel's real verdict instead of leaving the PR silently stuck.

## Premise check (2026-09-29) — already done, resolved without new code

Re-read against fresh `main` at claim time (conveyor-4380, lane-17): this item's own `bornAs` (`x5s8b47`)
already shipped, landed, and merged before this dispatch picked the card up.

- `git log --all` on the WE control checkout surfaces `b93d13e29 fix(review-pr): judgeAdvisory
  quota-holds/degrades instead of crashing the run (#x5s8b47)` and its same-day follow-up
  `466605269 WE #x5s8b47 follow-up: judgeCorrectnessAdvisory quota-holds/degrades too`, both merged to
  `main` via PR #2883 (`82b19d95e`). `git merge-base --is-ancestor` confirms both are ancestors of the
  fresh `main` this lane forked from.
- The diff matches this card's MVP cut exactly: `createDefaultJudge` (`we:scripts/operations/cli-adapter.mjs`)
  now checks the seat's provider against the shared quota-hold store (reusing
  `we:scripts/operations/review-extra-seats.mjs#quotaHold`) before spawning, via a new `gracefulOnUnavailable`
  request flag that `we:scripts/operations/review-pr.mjs`'s `judgeAdvisory` (and, in the follow-up,
  `judgeCorrectnessAdvisory`) requests now set; a held/unavailable provider falls back or skips with a
  structured `findings.judgeAdvisory.skipped` marker instead of crashing the run, and any spawn that still
  throws is caught and recorded the same way. `we:scripts/operations/review-job.mjs`'s `crashLabelFromLoop`
  now prefers the child's own deliberate `error: ` stdout line over stderr noise, closing the observability
  gap.
- **Live before/after re-verification in this lane** (not just trusting the merged diff): overlaid the
  pre-fix (`9f7dd3d3e`, the parent of `b93d13e29`) versions of `we:scripts/operations/cli-adapter.mjs`,
  `we:scripts/operations/review-job.mjs` and `we:scripts/operations/review-pr.mjs` under the CURRENT
  (post-fix) test files and ran the fix's own three test files
  (`we:scripts/operations/__tests__/judge-provider-port.test.mjs`,
  `we:scripts/operations/__tests__/review-job.test.mjs`, `we:scripts/operations/__tests__/review-pr.test.mjs`):
  9 failures, including `runReviewJob`'s crash-label test asserting the OLD code surfaces `"review-loop exit 1:
  (node:12345) [DEP0040] DeprecationWarning..."` instead of the real `"spawn codex ENOENT"` — reproducing this
  card's own "only a stray deprecation-warning line survives" symptom live. Restoring the post-fix files
  (`git checkout -- <files>`) turned all 288 tests green, with the graceful path logging
  `judge seat skipped — codex unavailable: quota exhausted; sitting out until 2026-10-03T17:11:11.000Z;
  fallback antigravity unavailable too` instead of crashing.

No further code needed — this card's own scope is fully covered by the merged fix. Resolving with
`graduatedTo` pointing at the commits that already closed it, per the standing premise-check rule (never
build a card that is already done). (This supersedes the stale scaffold placeholder that duplicated
`## Done when` with an unfilled `TODO:` line — removed here as satisfied by the real criterion above and by
this premise check.)
