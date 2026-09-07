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

Coroner-audit + capacity sweeps found the 'already-done' hold signal (we:scripts/operations/dispatch-lane-io.mjs#filterAlreadyDoneCandidates, deliberately hold-only per #3457/#3460) surfaces real matches that then just sit forever -- #3570 (bornAs xhgw5nu) is filed to fix the surfacing/sweep half (stage 1: cheap, mechanical, high-recall candidate detection), but explicitly leaves open HOW a surfaced candidate actually gets closed out, offering only 'a batch-reviewable list for a session to clear' or 'a second, still-mechanical gh call confirming the diff' -- neither is real judgment. The operator's framing is explicit: verifying an already-done claim needs someone/something to actually read the merged PR's diff and the item's own described behavior and confirm they truly match before resolving (or correct the card, like #3485, if they don't) -- pure pattern-matching (a title/number regex, or even a second gh diff check) cannot replace that. #3567 (bornAs x6qdz9n, kind: investigation dispatch briefs) is landing the exact mechanism this needs: a dispatched investigator that checks first, verifies against real code/PRs, and produces a short-plain report -- but it is a GENERAL capability with no already-done-specific wiring. This item is the stage-2 half: once #3567 ships, wire #3570's surfaced already-done candidates to spawn a scoped kind:investigation item per candidate (title/digest naming the specific NNN + its claimed delivering PR) whose brief asks it to confirm the PR's actual diff genuinely delivers the card's described behavior/scope, then either resolve the item for real (we:scripts/backlog.mjs resolve, with a verification note citing the PR/commit evidence) or correct the card's claim if it does not hold.

## Ruling (ratified 2026-09-07, operator)

**Ratified: auto-resolve.** A HIGH-CONFIDENCE stage-2 investigation verdict gets outright resolve authority: it calls `we:scripts/backlog.mjs resolve` itself, citing the PR/commit evidence it verified against, rather than only recommending resolve for a human to confirm (the review:pending uncleared-hold pattern is not required here).

**Doctrine-gap note, recorded per operator instruction.** This fork was embedded in a `kind: task` item's body rather than carved into its own `kind: decision` item -- a real gap in this repo's decision-authoring convention, flagged to the operator rather than silently worked around. Rather than run the full `/prepare` ceremony for a fork this size, the operator chose to rule directly. **Ratified inline here, not through a full decision item, by explicit operator choice.**

**Safety rails (auto-resolve is a real trust delegation -- an investigation can close a backlog item with no human review):**

1. **Evidence, not assertion.** The investigation's resolution note must cite concrete evidence: the delivering PR number and/or commit SHA, AND the specific diff lines or observed behavior it verified against the card's own described scope/behavior -- a bare confidence claim ("looks done") is not sufficient grounds to resolve.
2. **Wrong auto-resolves must be correctable.** A resolved-in-error item goes back through the normal reopen path (flip `status` back to `open` with a note explaining why), not treated as irreversible. This does not need its own dedicated review-gate mechanism -- a citation requirement plus a normal reopen path is the right amount of rail for this delegation's size.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
