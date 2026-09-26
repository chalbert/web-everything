---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/couple-cascade.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# couple-cascade's coupleSplit residual has no operator escalation (fix-couple-split, PR #2763)

LIVE FINDING (2026-09-26), surfaced while updating we:scripts/conveyor/flows/drain-land.flow.json for PR #2763 (fix-couple-split). we:scripts/lib/couple-cascade.mjs's own header names a residual it cannot close: a WE carrier's own gh pr merge can still fail AFTER its impl half already landed (a GitHub error in the ~1s between the two writes) — the two repos cannot merge atomically. we:scripts/merge-ai-prs.mjs's noteSplit() (called from its runCli merge loop, e.g. around the fresh-re-read-refused and merge-failed call sites) pushes an entry onto coupleSplit and writes one loud stderr line + the pass's own JSON, by design ('reported ... loudly' per the header) — but nothing ELSE consumes it: no desktop notification, no PR comment, no priority re-attempt, no cap on how many passes the same split can recur silently-except-for-a-log-line. An impl half sitting merged on its own repo's main with its WE carrier repeatedly failing to follow it is a real inconsistency (the WE side may lack code the impl now depends on) and currently relies entirely on a human noticing a stderr/JSON line. Needs: an explicit escalation path (e.g. reuse the drain daemon's existing desktop-notify + one-time-per-episode pattern already used for lease-wait-escalated / failure-streak-escalated in we:scripts/conveyor/flows/drain-land.flow.json) once a coupleSplit repeats past some small bound. Referenced (not fixed here) as an unbounded-retry / no-escalation checker finding from we:scripts/conveyor/flows/drain-land.flow.json's couple-gate state.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
