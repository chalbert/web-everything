---
kind: story
size: 3
parent: "3861"
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/__tests__/gh-throttle.budget-block.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# gh-throttle logs a hardcoded default GraphQL cost per call instead of GitHub's real reported cost, undercounting true spend

Investigating this account's 5 GraphQL primary-budget exhaustions on 2026-09-29 needed more than gh-throttle's own call ledger (we:scripts/lib/gh-throttle.mjs's recordGhCallLogEntry, calls.jsonl) because that ledger logs a hardcoded default 'points':1 for essentially every GraphQL call -- the vast majority of this week's logged lines carry the literal default, never the real GitHub-reported cost. Real per-call cost varies well above 1: the sporadic lines that do carry a raw rate-limit snapshot (present on roughly a fifth of today's graphql-resource lines) show a single logged call can correspond to several real GitHub point charges -- we:fix-procedure.mjs's tracked calls today averaged roughly 2.1 real points per declared-1-point call, and a single we:pr-land.mjs 'pr edit' line carried four separate rate-limit increments within one logged call. Because the declared 'points' value is never reconciled against the real delta, ranking callers from the ledger alone (call count times declared points) undercounts any caller whose queries are heavier than the default, and this trace had to fall back to hourly call-count correlation plus the one budget-block sidecar record that happened to capture a real detection, rather than reading the answer straight off the ledger the module's own header promises is one grep. MVP: when a call's captured trace carries a real rate-limit delta (the primary-exhaustion detector in we:scripts/lib/gh-throttle.mjs already parses this shape via parseGhDebugResponseHeaders/classifyRateLimitSignal), compute the real per-call cost from the delta between consecutive same-identity 'used' values and persist it as the logged cost (either overwrite the 'points' field or add a sibling 'realPoints' field) instead of the caller-declared default; when no real delta is available (the common case today, since header calibration is opt-in per call), keep the existing declared-default behavior unchanged so no existing caller's contract changes. Soak-break proof plan: a fixture that replays a known multi-request rate-limit sequence through recordGhCallLogEntry and asserts the logged entry's cost field reflects the real spend rather than the declared default -- RED before (logs the declared default), GREEN after (logs the reconciled real cost).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
