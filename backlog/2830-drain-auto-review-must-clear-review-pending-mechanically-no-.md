---
bornAs: x2tqdk3
kind: story
size: 5
parent: "2612"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, orchestrator-mechanization, drain, review]
---

# Drain auto-review must clear review:pending mechanically — no human wait

A PR at `review:pending` with green CI should be picked up by the drain's own independent auto-review pass and cleared to `review:accepted` (or routed to `review:changes`) with NO human. Tonight it did not fire: gate PRs #974 and #975 sat at `review:pending` + green CI and were never auto-cleared — they waited for a human, so the conveyor stalled. The drain must actually RUN the agent-reviewable auto-review on `review:pending` PRs and dispose them mechanically.

## The concrete gap — what the main session did by hand tonight

- **PRs #974 and #975 stalled at `review:pending` with green CI.** Nothing advanced them. The drain has an independent auto-review pass (the agent-reviewable contract), but on these PRs it never fired — they just sat waiting for a human to open `/review`.
- The main session was the only thing that could move them, which is exactly the manual review step the conveyor is meant to remove.

## Why this blocks a session-free conveyor

`review:pending` is supposed to mean "waiting for the drain's independent (non-author) auto-review," NOT "waiting for a human." If the auto-review does not actually run, then every gate PR parks at `review:pending` forever until a person clears it. A session-free conveyor cannot make forward progress past its own review gate — the gate becomes a hard stall on human availability. The whole point of the agent-reviewable contract is that a machine reviewer clears these; if it silently doesn't fire, the conveyor is not session-free.

## The mechanical fix

- **Actually run the independent auto-review pass on `review:pending` PRs.** The drain detects a PR at `review:pending` with green CI and dispatches its non-author auto-review (per the agent-reviewable contract / shared review core), then disposes: clear to `review:accepted` when the review passes, or route to `review:changes` (bounce to the author lane) when it finds blocking issues. No human step in the loop.
- **Investigate and document WHY it currently doesn't fire.** Before fixing, determine the root cause — is the pass not scheduled on `review:pending`? Is it gated on a label/state that these PRs don't have? Is it dispatched but crashing/timing out silently? Record the finding so the fix targets the actual cause, not a symptom.
- Honor the non-author invariant (#2439): the auto-review is an INDEPENDENT pass, never the author clearing their own PR.

## Cross-references

- **#2820** — the merge predicate that treats `review:pending` as an unsatisfied hold. This item supplies the mechanism that SATISFIES that hold without a human.
- **#2439** — non-author clear (conflict-of-interest invariant): the auto-review must be independent of the author.
- The shared review core (`we:scripts/lib/review-core.mjs`) is the engine this pass runs.

## Acceptance

- A PR at `review:pending` with green CI is picked up by the drain and its independent auto-review is actually dispatched (observable in the drain's own record), with no human trigger.
- The auto-review disposes the PR mechanically: clears to `review:accepted` on pass, or routes to `review:changes` (author-lane bounce) on blocking findings.
- The clear is done by a NON-author review pass (#2439), never by the author.
- The root cause of why the pass did not fire on #974/#975 tonight is investigated and documented, and the fix targets that cause.
- Regression: a `review:pending` + green-CI PR like #974/#975 is auto-disposed without a main session opening `/review`.
