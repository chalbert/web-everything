---
bornAs: xuedv78
kind: story
size: 5
parent: "3383"
relatedTo: ["3437", "2439", "2844"]
status: resolved
dateOpened: "2026-09-02"
dateResolved: "2026-09-03"
tags: [conveyor, review-pr, resume, dispatch]
scope:
  - we:scripts/operations/
  - we:scripts/__tests__/
  - we:skills-src/review/
---

# Mechanize review-pr resume-dispatch: verify UNKNOWN effects against ground truth, then dispatch a fresh session to resume

A review-pr run whose record step leaves an effect UNKNOWN after a transient failure correctly refuses a blind --resume, and self-clear-refused when the only session available is the PR author lineage — today unsticking it needs a human or an ad-hoc peer ask. Mechanize the legitimate route the refusal itself names: verify the effect against live ground truth, mark it applied/failed, then dispatch a genuinely fresh, independent session to run the resume.

## Root cause — what happened tonight, and why both refusals were correct

A `review-pr` run for PR #1825 reached a real, independent verdict (two jurors, converged and accepted). Its `record` step tried to apply the `review.label-swap` effect and hit a transient GitHub 502 mid-request. The run record was left with that effect's outcome as `UNKNOWN` — not `idempotent` — so a blind `we:scripts/operations/run.mjs review-pr --resume=<runId>` correctly refused: "effect ... was attempted and its outcome is UNKNOWN ... Refusing. Resolve it by hand."

The orchestrating session resolved it by hand: `gh pr view <PR> --json labels` showed the swap had never actually landed (still `review:pending`), so the run record's one effect entry was hand-edited from `pending` to `status: "failed"`, and `--resume` was re-run. That second attempt hit a different, more fundamental refusal: `we:review-set-label.mjs`'s self-clear guard (`#2439`) correctly blocked it, because the orchestrating session's own id was in the PR's author lineage — a subagent it had dispatched to open the PR inherits the parent session's id (`#2844`), so the orchestrating session could not be the clearing actor for its own authored PR.

The orchestrating session then asked a peer session — the original independent reviewer, already done with its own work — to run the resume in its place. The peer correctly refused: being asked, by the very session that had just been blocked, to perform the same action on its behalf, with no independent way to verify the claims, is exactly the permission-laundering pattern `#3437`'s session-name-independence doctrine exists to catch. The peer's own dispatch brief also scoped its job to report-and-exit once the review loop's outcome fell outside the normal bounce/auto-clear/park arc; resuming on a peer's say-so was never its call to make.

Both refusals were correct, working exactly as designed — this is not a bug to route around. It is a gap in what is mechanized: right now, unsticking a run stuck in this shape requires a human to either run the resume themselves or explicitly authorize a specific session to. The error message that started this already names the legitimate way out — "resolve it by hand," and the self-clear guard's own logic accepts a genuinely different, independent session — but nothing today performs that path mechanically.

## What's actually missing

A mechanized "review-pr resume-dispatch" operation, parallel in spirit to how `we:scripts/operations/review-dispatch.mjs` already dispatches a genuinely fresh, independent `claude --bg` session (its own session id, never inheriting a caller's) to run an initial review — except this one's job is narrower. Given a stuck `review-pr` run-id (or PR number), it should:

1. **Mechanically verify** any effect left `UNKNOWN` after a transient failure against real ground truth. For `review.label-swap` specifically: read the PR's current labels via `gh pr view` and compare against the effect's own `addLabel`/`removeLabels` payload to determine definitively whether it actually applied — the exact reconciliation a human did by hand tonight.
2. **Mark that effect `applied` or `failed`** on the run record accordingly — never guessed, always checked against live state.
3. **Dispatch a fresh, independent session** (a new session id by construction, e.g. the same `claude --bg --session-id=<fresh-uuid>` pattern `we:scripts/operations/review-dispatch.mjs` / `we:scripts/operations/dispatch-abort.mjs` already establish) whose sole job is to run `we:scripts/operations/run.mjs review-pr --resume=<runId>`.

This does **not** weaken or bypass the self-clear guard (`#2439`) or the independent-session bar (`#3437`'s doctrine) — it mechanizes the legitimate "genuinely different session" route the error message already names, instead of leaving it to an operator or an ad-hoc peer ask every time.

It should generalize to any `review-pr` (or `resolve`, or other declared operation with non-idempotent effects) run stuck in this same "effect outcome unknown after a transient failure, self-clear-refused on resume" shape — not hard-coded to PR #1825's specific label-swap payload, though that is the concrete case to build and test against first.

## Done when

1. **A regression test reproduces the stuck shape end to end**: an effect is marked `UNKNOWN` after a simulated transient failure (e.g. a stubbed GitHub 502 mid-apply on `review.label-swap`), ground-truth verification correctly determines applied-vs-failed by comparing live labels against the effect's own payload (both outcomes covered — a case where the swap silently landed anyway, and a case where it didn't), and a fresh, independent session (a distinct session id, never inherited from the caller) is dispatched and the `--resume` actually completes and lands the effect.
2. **The self-clear guard (`#2439`) and the independent-session bar (`#3437`) are never weakened or special-cased** by the new path — the dispatched session must be a *genuinely* independent session by construction (new id, not `Agent`-tool inheritance per `#2844`), verified by an assertion in the test, not by convention.
3. **Ground-truth verification never guesses** — if the live-state check for an `UNKNOWN` effect is itself inconclusive (e.g. the `gh pr view` call fails), the operation halts and surfaces for a human rather than marking the effect either way.
4. **Generalizes beyond the one payload shape** — the verification step is pluggable per effect type (starting with `review.label-swap`, but not hard-coded to PR #1825's specific label set), so a future non-idempotent effect on `review-pr`, `resolve`, or another declared operation can register its own ground-truth check rather than needing a new bespoke script.
5. **A live proof against the real PR #1825 case** once built: run the new operation against that PR's actual stuck run record (or an equivalent still-stuck case if #1825 has since been resolved by hand) and confirm it reaches the same correct outcome tonight's manual resolution did, with no human touching the run record or dispatching the resume session by hand.
