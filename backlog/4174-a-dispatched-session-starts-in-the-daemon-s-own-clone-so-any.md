---
bornAs: xm5i1xm
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/stuck-pr-inspect-dispatch.mjs", "we:skills-src/conveyor", "we:skills-src/review", "we:scripts/conveyor/soak/breaks/session-junk-in-daemon-clone.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# A dispatched session starts in the daemon's own clone, so any scratch file it writes before moving to its lane dirties the clone and freezes self-sync

Found by the daemon soak harness (card 4169, break session-junk-in-daemon-clone). we:scripts/operations/dispatch-lane-io.mjs#createDispatchSinks spawns every claude --bg session with cwd = the dispatching daemon's own clone (its docblock: the cwd the agent starts in; the agent acquires its own lane later). A session that writes a scratch or log file with a relative path before it moves into its lane leaves an untracked file in the daemon clone; self-sync then refuses the dirty clone, the clone falls behind main, and every dispatch after that is refused as stale-main (soak: 125 invariant violations over 50 ticks from ONE junk file). Same class as the we:.conveyor/unsupported-repo.json and we:scripts/conveyor/run-scorecards.json incidents of 2026-09-25. Candidate fixes: spawn sessions in a throwaway or dedicated start dir outside the clone, or make the rebuild tolerate untracked non-state files. Proof: node we:scripts/conveyor/soak/red-green.mjs --break=session-junk-in-daemon-clone must turn GREEN.

## Done when

1. **Executable** — `npx vitest run --config we:vitest.soak.config.ts we:scripts/conveyor/soak/breaks/session-junk-in-daemon-clone.soak.test.mjs` flips from EXPECTED-FAIL to a required, passing test (equivalently: `node we:scripts/conveyor/soak/red-green.mjs --break=session-junk-in-daemon-clone` reports RED on the pre-fix tree and GREEN on this one).
