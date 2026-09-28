---
kind: story
size: 3
priority: high
status: open
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/open-pr.mjs", "we:scripts/operations/deliver-item-run.mjs"]
dateOpened: "2026-09-28"
tags: ["build-dispatch", "converge", "open-pr"]
---

# Build finished with no PR (#4125: 'finished — PR #null')

we:scripts/operations/deliver-item-wrapper.mjs's deliverItem unconditionally reports success once openPr() returns: it builds `PR #${prResult.pr} (${parkDecision.label})` and calls finish(...,{status:'ok',outcome:'pr-opened'}) without ever checking prResult.outcome. When open-pr is REFUSED (#4125: HEAD d7350a37 landed after the verify recorded for 5348fd58, so --require-verified refused the create), the wrapper still logs a false success and we:scripts/operations/deliver-item-run.mjs prints 'finished — PR #null (review:pending)', discarding the real refusal reason and the finished build's own branch.

## Evidence (2026-09-28, live)

- Wrapper log conveyor-4125.log (delivery-dispatch-logs) last line: `deliver-item-run: #4125 finished — PR #null (review:pending)`. That line is written unconditionally by we:scripts/operations/deliver-item-run.mjs L167 (`write(\`deliver-item-run: #${launch.item} finished — ${result?.result ?? '(no result reported)'}\n\`)`), which never distinguishes a real PR from a refusal string.
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
2. we:scripts/operations/deliver-item-run.mjs's `finished — ...` line (L167) is generic by design (it prints whatever `result.result` says) — once (1) lands, that line will carry the real reason automatically; no change needed there beyond verifying it.
3. A run that ends in a refusal should surface the lane/branch/commit it built so recoverable work like #4125's is never only findable by manually reading reflogs — file as a follow-up if it's not already covered by #4349's "route to a hold with the reason" scope.
4. Note: the build-dispatch daemon still counting a finished-with-no-PR run as `in-flight` for hours is the SEPARATE, already-filed #4349 — not re-scoped here.

## Done when

1. **Executable** — a test asserting `deliverItem`'s PR-open step returns a result string that is NOT `PR #null` and reports `prResult.reason` when `openPr()` returns `{outcome: 'refused', pr: null, reason: '...'}` (e.g. a focused unit test on the PR-open branch of we:scripts/operations/deliver-item-wrapper.mjs, or an integration test on we:scripts/operations/deliver-item-run.mjs with a stubbed refused `openPr`) — fails today (asserts the current code returns `PR #null` unconditionally), passes once the outcome check lands.
