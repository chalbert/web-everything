---
bornAs: xvzwiew
kind: task
parent: "3963"
status: resolved
scope: ["we:skills-src/conveyor/review-daemon.mjs", "we:scripts/operations/review-dispatch.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# review daemon hits spawnSync claude ENOENT dispatching frontierui reviews

The 2026-09-23 multi-repo audit saw the review daemon log spawnSync claude ENOENT for a frontierui review while web-everything and plateau-app dispatched fine. An ENOENT from spawnSync is also what a missing cwd produces, not only a missing binary -- check the cwd the frontierui dispatch spawns claude in, then fix whichever it is.

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/review-daemon.test.mjs` (the `#xvzwiew` describe blocks) fails on the pre-fix code and passes after.

## Resolution notes (2026-09-23)

Reproduced for real, root cause found, cwd hypothesis RULED OUT:

- `dispatchReview` (we:scripts/operations/review-dispatch.mjs) never varies the `claude` spawn's cwd by repo —
  it always uses the dispatching checkout's own `REPO_ROOT`, confirmed by direct read; `{{LANE_REPO}}` is a
  brief placeholder only, never the spawn cwd. `defaultListAgents`'s `claude agents --json` read
  (we:scripts/operations/dispatch-lane-io.mjs) takes no cwd at all. So "a missing cwd" cannot explain this —
  ruled out with evidence, not assumed.
- The real production log (`~/workspace/wev-review-daemon/.conveyor/review-daemon.log`) shows the SAME
  `spawnSync claude` failure (ENOENT, also `Unknown system error -8`, also `ETIMEDOUT` at other times) hitting
  ALL THREE constellation repos over time, at the `claude agents --json` read inside
  we:scripts/conveyor/reconcile-pass.mjs's `defaultReadAgents` — a transient spawn flake under load, not a
  deterministic missing-binary/cwd bug.
- The REAL, in-scope bug this transient flake exposed: `runReviewTick` (we:skills-src/conveyor/review-daemon.mjs)
  never caught a `reconcile({repo})` throw — the one step in the file's own "one bad entry never aborts the
  rest" discipline that was NOT isolated. A reconcile hiccup threw straight out, and `runReviewTickAllRepos`
  then reported that ONE failure TWICE, misleadingly: once as `chalbert/frontierui#? failed (non-fatal):
  spawnSync claude ENOENT` (as if a SPECIFIC PR's review dispatch had failed, when no PR was ever even
  identified) and once as `chalbert/frontierui reconcile failed (non-fatal, other repos unaffected): ...`.
- Fixed: `reconcile({repo})` is now wrapped in try/catch, returning `reconcileError` instead of throwing;
  `runReviewTickAllRepos` folds it into a new `reconcileFailed` bucket, never into `failed`; `onTick` logs it
  through one clear line instead of two contradictory ones.
- Proof: reproduced with a real, read-only `gh pr list` per repo plus a real, merged FrontierUI PR (#50, since
  frontierui has zero open PRs today) fed through the real planner, and the exact observed low-level spawn
  error fault-injected at the one real call site that throws it. Red then green vitest in
  we:skills-src/conveyor/__tests__/review-daemon.test.mjs (`#xvzwiew` describe blocks).
