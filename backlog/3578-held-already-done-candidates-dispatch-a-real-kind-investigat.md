---
bornAs: xlitqp2
kind: task
status: open
blockedBy: ["3567"]
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:skills-src/conveyor/investigation-agent-brief.md"]
dateOpened: "2026-09-07"
tags: []
---

# Held already-done candidates: dispatch a real kind:investigation verify-then-resolve pass, not blind trust

Coroner-audit + capacity sweeps found the 'already-done' hold signal (we:scripts/operations/dispatch-lane-io.mjs#filterAlreadyDoneCandidates, deliberately hold-only per #3457/#3460) surfaces real matches that then just sit forever -- #3570 (bornAs 3570) is filed to fix the surfacing/sweep half (stage 1: cheap, mechanical, high-recall candidate detection), but explicitly leaves open HOW a surfaced candidate actually gets closed out, offering only 'a batch-reviewable list for a session to clear' or 'a second, still-mechanical gh call confirming the diff' -- neither is real judgment. The operator's framing is explicit: verifying an already-done claim needs someone/something to actually read the merged PR's diff and the item's own described behavior and confirm they truly match before resolving (or correct the card, like #3485, if they don't) -- pure pattern-matching (a title/number regex, or even a second gh diff check) cannot replace that. #3567 (bornAs 3567, kind: investigation dispatch briefs) is landing the exact mechanism this needs: a dispatched investigator that checks first, verifies against real code/PRs, and produces a short-plain report -- but it is a GENERAL capability with no already-done-specific wiring. This item is the stage-2 half: once #3567 ships, wire #3570's surfaced already-done candidates to spawn a scoped kind:investigation item per candidate (title/digest naming the specific NNN + its claimed delivering PR) whose brief asks it to confirm the PR's actual diff genuinely delivers the card's described behavior/scope, then either resolve the item for real (we:scripts/backlog.mjs resolve, with a verification note citing the PR/commit evidence) or correct the card's claim if it does not hold. OPEN FORK, not resolved here (flag for a human/operator glance, do not decide silently): how aggressively should a HIGH-CONFIDENCE stage-2 investigation verdict auto-resolve vs. always park for a human glance even after verification -- e.g. does the investigation get resolve authority outright, or does it only recommend resolve (mirroring review:pending's uncleared-hold pattern) for a human/operator to confirm. Needs its own short decision before this item's dispatch-authority scope is finalized.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
