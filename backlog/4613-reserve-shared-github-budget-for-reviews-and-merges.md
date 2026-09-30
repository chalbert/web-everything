---
bornAs: x9izsww
kind: story
size: 3
status: resolved
preparedDate: "2026-09-30"
scope: ["we:scripts/lib/gh-throttle.mjs"]
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
tags: []
---

# Reserve shared GitHub budget for reviews and merges

Prioritize review and merge calls in we:scripts/lib/gh-throttle.mjs; defer discovery before shared GraphQL allowance is exhausted, with visible non-error results.

## Prep

Operator decision, 2026-09-30 around 08:00 ET: serve reviews and merges before background discovery when the shared allowance is scarce.

Admission in we:scripts/lib/gh-throttle.mjs retains captured GraphQL remaining/limit/reset per identity. Background defers below 25%; normal below 10%; critical bypasses this reservation, never true exhaustion or secondary backoff. Unknown or expired observations fail open. Deferred calls emit a non-error JSON result and daemon diagnostic, and we:scripts/lib/gh-spend.mjs counts them separately from spending.

Critical: review-daemon, review-set-label, review-pr, merge-ai-prs; pr-land landing attribution or merge calls; ci-heal push attribution or mutations. Background: dispatch-plan, conflict/progress watchers, lane-whois, reconcile snapshots. Other attribution is normal.

Snapshot and watcher readers preserve deferral instead of caching an empty list. Changes to high-spend caller attribution remain owned by the concurrent job.

## Done when

Run `npx vitest related` with `--run` for the changed files; prove thresholds, caller attribution, non-error deferral, critical admission, expiry, identity isolation, snapshot preservation and report visibility. Run the standards gate, then rebase on origin/main without committing.

## Verification

- Focused `npx vitest related ... --run`: 385 tests passed across priority admission, shared snapshots, conflict/progress watchers and reconcile pass readers.
- The underlying standards checker completed with zero errors. The npm wrapper could not create its shared admission lock outside the sandbox.
- The final broad related suite passed 12,166 tests; eight tests failed across four suites requiring real sockets, process-table reads or a home-directory drain lock denied by this sandbox (plus one unhandled socket EPERM). Eleven tests were skipped.
- Requested fetch/rebase attempted: `we:.git/FETCH_HEAD` and `we:.git/index.lock` writes were denied by the sandbox. No commit, push or PR was made; the diff remains for human review and rebase.
