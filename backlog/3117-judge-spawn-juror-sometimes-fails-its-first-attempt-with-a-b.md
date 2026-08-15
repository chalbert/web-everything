---
bornAs: xn85i4a
kind: task
status: open
dateOpened: "2026-08-14"
priority: low
tags: [operations, review, reliability, footgun]
scope:
  - we:scripts/lib/judge-spawn.mjs
---

# judge-spawn juror sometimes fails its first attempt with a bare, uninformative error

Across four review-prep live-fire runs tonight, the underlying judge-spawn juror failed its FIRST attempt twice (50%) with 'judge-spawn: the juror failed: <no result text>' — parsed.result was empty, so the thrown error carries no diagnostic content. Both times a bare retry of the identical command succeeded. Distinct from #3105 (the gate-timeout stall): this is a fast, immediate is_error from the spawned claude -p subprocess itself, not a foreground-window timeout. we:scripts/lib/judge-spawn.mjs:438 throws the CLI's own result text verbatim when is_error is set, so when that text is empty the caller has nothing to act on. Worth capturing stderr or the raw parsed object in the thrown message when result is empty, so a future occurrence is diagnosable without blind retry. Not investigated further; retry resolved both instances.
