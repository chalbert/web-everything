---
bornAs: xtl3b09
kind: story
size: 3
priority: high
status: active
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs", "we:scripts/operations/__tests__/deliver-item-run.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "75d78f50e9b0e1f5c9daeccca8aa902db1cae9f2"
tags: ["build-dispatch", "converge", "open-pr"]
---

# Build finished with no PR (#4125: 'finished — PR #null')

we:scripts/operations/deliver-item-wrapper.mjs's deliverItem unconditionally reports success once openPr() returns: it builds `PR #${prResult.pr} (${parkDecision.label})` and calls finish(...,{status:'ok',outcome:'pr-opened'}) without ever checking prResult.outcome. When open-pr is REFUSED (#4125: HEAD d7350a37 landed after the verify recorded for 5348fd58, so --require-verified refused the create), the wrapper still logs a false success and we:scripts/operations/deliver-item-run.mjs prints 'finished — PR #null (review:pending)', discarding the real refusal reason and the finished build's own branch.

## Evidence (2026-09-28, live)

- Wrapper log conveyor-4125.log (delivery-dispatch-logs) last line: `deliver-item-run: #4125 finished — PR #null (review:pending)`. That line is written unconditionally by we:scripts/operations/deliver-item-run.mjs L181 (`write(\`deliver-item-run: #${launch.item} finished — ${result?.result ?? '(no result reported)'}\n\`)`), which never distinguishes a real PR from a refusal string.
- The actual `open-pr` attempt for this run is the operations coordination run record `open-pr-355ee9ac-6599-4583-9d73-f6ce5db935d8` (`ref: lane/4125-job-model-core-durable-job-records-detached-launch-reattach`, timestamped 2026-09-28T15:53:22–23Z — matching the wrapper log file's own mtime, 11:53:23 local). Its `submit` effect: `outcome: "refused", reason: "unverified", detail: "refusing to land … the recorded verification is for 5348fd58, not the HEAD being landed (d7350a37) … run node we:scripts/verify-lane.mjs …", pr: null`.
- we:scripts/operations/deliver-item-wrapper.mjs L490-492 does not branch on that `outcome`/`reason` at all: `return finish(\`PR #${prResult.pr} (${parkDecision.label})\`, { status: 'ok', outcome: 'pr-opened', pr: prResult.pr ?? null, park: parkDecision.label })` — the "PR #null" string IS this line, running unconditionally, and it stamps `status:'ok'` on a refused submit.
- we:scripts/operations/open-pr.mjs L315-353 (`classifySubmit`) and its `extractSubmitResult` companion already produce a real, structured `outcome: 'opened'|'refused'|'unrun'` plus `reason`/`detail` — the wrapper receives this shape but throws away everything except `.pr`.
- The build-dispatch daemon log hit a GraphQL rate-limit backoff shortly before this (`tick failed (non-fatal): gh-throttle … shared backoff until 2026-09-28T14:22:54.000Z`), which delayed #4125's actual dispatch to ~14:56Z (per the dispatch-lane run record's own read/dispatch step timings) — context for the timeline, not the cause of the missing PR: the backoff had long cleared by the time the wrapper called `open-pr` at 15:53Z, and that call's own refusal reason (stale verification) is unrelated to GraphQL throttling.
- The build-dispatch daemon log also still reports lane 9 `in-flight` at 17:00:01Z, hours after the wrapper exited — the known #4349 defect (a finished wrapper never settles its run record/claim). Not re-litigated here.

## Root cause

`deliverItem`'s PR-open step (we:scripts/operations/deliver-item-wrapper.mjs L471-492) treats `openPr()`'s return as always a success. It never checks `prResult.outcome === 'refused'` (or `'unrun'`) before formatting the "finished" message and closing the telemetry span with `status: 'ok'`. A refusal (stale verification, a park-label conflict, a `pr-land` crash, anything `classifySubmit` already names) is indistinguishable, at every downstream reader, from a genuinely opened PR — except that `pr` reads `null`.

## Is #4125's work recoverable? — yes, right now, but at risk

Lane 9 has since been reset to `origin/main` and reused to deliver #4056; there is no live branch or ref for #4125 anymore (confirmed: no local or remote branch matching 4125). The two real commits are NOT yet garbage-collected — both are reachable via that lane's own reflog today:
- `5348fd58b` — "WE #4125: delivery build" (`refs/heads/main@{2}`, `HEAD@{8}`)
- `d7350a377` — "WE #4125: converge round 1 revision" (`refs/heads/main@{1}`, `HEAD@{7}`)

Per this task's instructions, **do not push or open a PR for this recovered work** — it is cited here only so a human/next pass can decide whether to cherry-pick it before `git gc` prunes the dangling commits. `git cat-file -t` on both hashes still returns `commit` as of this writing.

## Fix design

1. we:scripts/operations/deliver-item-wrapper.mjs's PR-open branch must inspect `prResult.outcome`. Only `'opened'` may call `finish(..., {status:'ok', outcome:'pr-opened', ...})`. `'refused'`/`'unrun'` must `finish` (or throw, matching this file's existing "a wrapper-side failure is not the agent's outcome" convention two lines below) with a result string that carries the REAL reason (`prResult.reason`/`.detail`), e.g. `open-pr-refused: ${prResult.reason}` — never a bare `PR #null`.
2. we:scripts/operations/deliver-item-run.mjs's `finished — ...` line (L181) is generic by design (it prints whatever `result.result` says) — once (1) lands, that line will carry the real reason automatically; no change needed there beyond verifying it.
3. A run that ends in a refusal should surface the lane/branch/commit it built so recoverable work like #4125's is never only findable by manually reading reflogs — file as a follow-up if it's not already covered by #4349's "route to a hold with the reason" scope.
4. Note: the build-dispatch daemon still counting a finished-with-no-PR run as `in-flight` for hours is the SEPARATE, already-filed #4349 — not re-scoped here.

## Done when

1. **Executable** — a test asserting `deliverItem`'s PR-open step returns a result string that is NOT `PR #null` and reports `prResult.reason` when `openPr()` returns `{outcome: 'refused', pr: null, reason: '...'}` (e.g. a focused unit test on the PR-open branch of we:scripts/operations/deliver-item-wrapper.mjs, or an integration test on we:scripts/operations/deliver-item-run.mjs with a stubbed refused `openPr`) — fails today (asserts the current code returns `PR #null` unconditionally), passes once the outcome check lands.

## Prepare — premise check (2026-09-30, against `main` @ 75d78f50e)

Premise HOLDS; not done, not superseded. Read on current `main`: `deliverItem` step 6 (`we:scripts/operations/deliver-item-wrapper.mjs:567-604`) still assigns `prResult = openPr(...)` and then unconditionally runs `settleTerminal('pr-opened', …)` and `finish(\`PR #${prResult.pr} (${parkDecision.label})\`, {status:'ok', outcome:'pr-opened', …})` (L601-604) with no read of `prResult.outcome`. `openPr` (L2428-2456) returns `extractSubmitResult(JSON.parse(out))`, whose shape is `classifySubmit`'s `{outcome:'opened'|'refused'|'unrun', reason?, detail?, pr, url}` (`we:scripts/operations/open-pr.mjs:287-353`). The only existing refusal handling is the thrown-error path (`classifyOpenPrFailure`, L2478, `blocked-on-infra` only); a *returned* refusal (the #4125 `unverified` case — `--requireVerified=true` is passed at L2453) falls straight through. `we:scripts/operations/deliver-item-run.mjs:181` just echoes `result.result`, so it needs no code change. Scope check: the frontmatter `scope:` lists the wrapper, `we:scripts/operations/open-pr.mjs`, and `we:scripts/operations/deliver-item-run.mjs`; the real touch-set is the wrapper (fix) plus its test file `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`. `we:scripts/operations/open-pr.mjs` needs no change (its shape is already sufficient) and `we:scripts/operations/deliver-item-run.mjs` only gets a verify-only assertion. Scope is corrected below to name the test file.

## Design

Add one branch in `deliverItem` between the `openPr` try/catch and step 7 (`we:scripts/operations/deliver-item-wrapper.mjs` ~L586): `if (prResult.outcome !== 'opened')` handle a returned refusal before the success path.

- **Refused / unrun, NO `pr`** (the #4125 shape: `reason:'unverified'`, `pr:null`): no PR exists. Do NOT release the lane via `releaseClaimAndLane` (L700; it resets the lane and is how #4125's work became reflog-only). Because a kept lane is still under a TTL lease the pool reaper can reclaim and reset, ALSO write a durable local ref in the lane, best-effort: `git update-ref refs/keep/<item>-<sha8> HEAD` (refs survive a lane reset; the reflog does not). Read the HEAD sha inside try/catch, falling back to `null`, so a git failure can never fall into the inner catch at L606 (which would release the lane and settle `wrapper-threw`). Call `settleTerminal('open-refused', { result:{ reason, detail, lane: gate.lanePath, sha, keepRef }, releaseClaim:true, hold:\`open-refused: ${reason}\` })`; releasing the claim here means `build-dispatch-claim` only; the backlog claim and lane lease stay held until lease expiry (same as `pr-opened`). Return `finish(\`open-refused (${reason}): ${detail}\`, { status:'error', outcome:'open-refused', reason, lane, sha })`. Run the learning drop (step 7) first, wrapped in try/catch.
- **Refused WITH a `pr`** (post-open: `check-red`, `behind`, `conflict`, `empty-body` are `refused`; `check-timeout` is `unrun` with a `pr` per `we:scripts/pr-land-reasons.mjs`): the PR EXISTS, so keep today's `pr-opened` claim treatment (claim left held; `build-dispatch-daemon#doneWhy` PR-observed retirement owns it, per the comment at L594-600), place NO hold and do NOT release the claim. Fix only the message and status: `finish(\`PR #${pr} open-refused (${reason}): ${detail}\`, { status:'error', outcome:'open-refused', pr })`, and settle as `open-refused` with `pr` in the result. Changing claim handling for live PRs is deliberately out of scope.
- **`unrun` with no `pr`**: same branch as the no-`pr` refusal; `reason` is the classifier's own explanatory string; never a bare `PR #null`. `unrun` WITH a `pr` (`check-timeout`) takes the with-`pr` branch above.
- `outcome === 'opened'` (and only it) keeps today's success path unchanged, including `settleTerminal('pr-opened', …)`.
- A tiny pure helper `describeOpenPrRefusal(prResult)` (exported, next to `openPr`) builds the message so the test can assert it directly.
- `we:scripts/operations/deliver-item-run.mjs:181` needs no change: it prints `result.result`, which now carries the refusal reason; the test asserts that end to end.

## MVP

Musts only:
1. `deliverItem` checks `prResult.outcome`; only `'opened'` reaches `finish(...,{status:'ok', outcome:'pr-opened'})`.
2. Refused/unrun returns `open-refused (<reason>)…` carrying `reason`/`detail`/`pr` (when present), `status:'error'`, never `PR #null`.
3. A refusal with no PR settles the run record as `open-refused` (not `pr-opened`), releases the build-dispatch claim, places a hold with the reason, does NOT release/reset the lane, writes a durable `refs/keep/…` ref (best-effort, sha read guarded) and records lane path + sha + keepRef in the settle result and outcome. A refusal WITH a PR only fixes message/status (Design).
4. Tests below.

OUT of scope (see Follow-ups): auto-pushing the stranded branch to a `lane/…` ref, lane-lifecycle/reaping for held-open lanes, refresh-verify-and-retry on `unverified`, claim/hold changes for refused-with-PR, #4349.

## Test plan

In `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`, next to the existing `PR #4321` cases (~L3204), reusing the file's `execFileSync` stub so `open-pr` returns a refused envelope:
1. **refused `unverified`, pr null** — stub `open-pr` JSON with `findings.submit.effects[0].result = {outcome:'refused', reason:'unverified', detail:'…5348fd58…d7350a37…', pr:null}`. Asserts `result.result` does not contain `PR #null`, contains `unverified`, starts with `open-refused`. Fails RED today: current code returns `PR #null (ready-to-merge)`.
2. **settle + hold** — same stub: run-store effect result has `outcome:'open-refused'` (not `pr-opened`), a `build-dispatch` hold with the reason was placed, the claim was released, and NO `we:scripts/lane-pool.mjs release` call was made for the lane. RED today: settles `pr-opened`, places no hold, claim left held.
3. **post-open refusal with a pr** — `{outcome:'refused', reason:'check-red', pr:777}`: message contains `PR #777` and `check-red`, outcome `open-refused` not `pr-opened`, `status:'error'`; claim stays held and NO hold placed (unchanged `pr-opened` claim treatment). RED today: reports success `PR #777 (…)`, `status:'ok'`.
4. **`unrun`** — `{outcome:'unrun', reason:'exit 3 with no parseable report…'}`: message carries that reason. RED today: `PR #undefined`/`#null` success.
4b. **sha read failure** — stub `git rev-parse` to throw during a no-`pr` refusal: result is still `open-refused` with `sha:null`, lane NOT released, no `wrapper-threw` settle. RED today: n/a-path (no branch exists); fails as `PR #null`.
7. **durable ref** — no-`pr` refusal issues `git update-ref refs/keep/…` in the lane (assert on `execFileSync` calls); a failing `update-ref` is swallowed.
5. **opened still succeeds** — the existing `PR #4321` cases (L3204-3234, L3289) stay green untouched (regression guard).
6. **`runDeliverItemCli` end to end** in `we:scripts/operations/__tests__/deliver-item-run.test.mjs`: with a stubbed `deliver` returning `{result:'open-refused (unverified): …'}`, the `finished — …` line contains the reason and no `PR #null`. (Verify-only; passes already given the echo, but pins the contract.)

## Proof plan

- Before/after against the real code, not just unit tests: with `we:scripts/operations/run.mjs open-pr` faked to return the captured #4125 refusal envelope (`open-pr-355ee9ac-6599-4583-9d73-f6ce5db935d8`'s `submit` result, read from the operations run store), run the real `runDeliverItemCli` and show the final log line: BEFORE (on `main`) `deliver-item-run: #4125 finished — PR #null (review:pending)`; AFTER `finished — open-refused (unverified): refusing to land … recorded verification is for 5348fd58, not the HEAD being landed (d7350a37)`. Attach both lines to the build PR.
- Show the dispatch run-store effect for that run reads `open-refused`, and `git -C <lane> rev-parse HEAD` still resolves after the run (lane not reset). Pair it with `git cat-file -t <sha>` and the `refs/keep/…` ref (the ref survives lease expiry; the lane does not). If the captured run-store record no longer exists, build the envelope by hand with the same shape (`openPrEnvelope` in the wrapper test file).

## Follow-ups

Each is a future backlog item for the BUILDER to file, none is needed for the MVP:
1. Held-open lanes need a lifecycle: a lane kept after `open-refused` must be surfaced (status/wip report) and reaped once a human recovers or discards the work, or lanes leak.
2. Auto-recover an `unverified` refusal: re-run `verify-lane` on the current HEAD and retry `open-pr` once (a stale verify after a converge revision commit is a mechanical, script-decidable case).
3. Publish the built branch to a `lane/…` ref before any refusal so the work is never reflog-only (may already fall under #4349's "route to a hold with the reason").
4. #4349 (finished wrapper never settles its run record) stays separate.
