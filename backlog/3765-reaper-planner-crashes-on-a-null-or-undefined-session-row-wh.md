---
bornAs: x0uufm6
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/conveyor/session-reap-plan.mjs", "we:scripts/conveyor/__tests__/session-reap-plan.test.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Reaper planner crashes on a null or undefined session row when a verdict resolver is given

`sessionReapPlan([null], { evidenceFor })` throws `TypeError: Cannot read properties of null (reading 'pidAlive')` and so does `[undefined]`. 

Reproduced 2026-09-20 on the tip of lane/mechanical-dispatcher (95aae605b): the throw is at `classifySessionReapWithVerdict` (we:scripts/conveyor/session-reap-plan.mjs, line 239, `pidAlive: session.pidAlive`), reached from `sessionReapPlan` (line 261). A string or a number as the row does not throw. Called with no `evidenceFor`, `[null]` does not throw either (the base classification is null tolerant, and the row lands in `keep` with reason `not-terminal`). Found by the reaper-split worker (its result note owed list), which also noted that `main()` guards non-object rows elsewhere, that verdicts are on by default, and that one such row in a listing would end the pass with "session-reaper crashed" (exit 1). Not confirmed: whether `claude agents --json` can ever return a null row; the crash is real for the planner as an API either way.

The file exists on lane/mechanical-dispatcher only. On main the planner is still inside the single we:scripts/conveyor/session-reaper.mjs, so this fix lands on the branch (or with the planner's graduation to main, a slice of #3443), not on main today.

DESIGN TO SETTLE.
1. Where to guard: at the top of `classifySessionReapWithVerdict` (return the same `keep` shape the null-tolerant base check already gives, and no verdict), or skip non-object rows in `sessionReapPlan` before classifying. Either way, a bad row must still appear in the plan's `keep` so nothing vanishes silently.
2. What reason a bad row carries (the existing `not-terminal`, or a new `malformed-row`), and whether `attentionRows` (which reads `r.session.id`) needs the same care. It only sees rows with a `stalled` or `waiting-permission` verdict, so a bad row never reaches it today.
3. Strings and numbers pass through today as a row with `verdict: "progressing"`. Decide whether they get the same treatment as null, or the current behaviour is pinned as it is.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/session-reap-plan.test.mjs` passes; these cases fail before this item lands:
   - `sessionReapPlan([null], { evidenceFor })` and `sessionReapPlan([undefined], { evidenceFor })` return a plan instead of throwing, with the bad row in `keep`.
   - a listing `[null, <a valid terminal row>, undefined]` still puts the valid row in `reap`, and the two bad rows in `keep`.
   - `sessionReapPlan([null], {})` (no resolver) keeps its current result.
   - the existing 36 cases in that file are unchanged and pass.
2. **Executable** — the reaper's own CLI tests still pass: `npx vitest run we:scripts/conveyor/__tests__/session-reaper-cli.test.mjs`.
