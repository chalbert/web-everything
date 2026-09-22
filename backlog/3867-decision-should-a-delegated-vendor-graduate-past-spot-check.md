---
bornAs: xohvzus
kind: decision
parent: "3383"
relatedTo: ["3690", "3850"]
status: open
dateOpened: "2026-09-22"
tags: []
---

# Decision: should a delegated vendor graduate past spot-check to a lighter or absent independent review after sustained high confidence — reopens ratified rule 7 of #delegation-trial-record-graduation

Operator proposal 2026-09-22: could a delegated vendor, after sustained high-confidence spot-check performance, graduate to a third, lighter-than-spot-check supervision tier, or no independent check at all. This conflicts with ratified rule 7 of we:docs/agent/platform-decisions.md#delegation-trial-record-graduation (the independent look is shallower but never absent) and SUPERVISION_LEVELS in we:scripts/lib/provider-routing.mjs (only full and spot-check exist) - reopening and amending an already-ratified statute clause, not preparing an unbuilt detail of an existing decision. Filed for later per the operator; do not action without the operator revisiting it.

## The proposal, verbatim

The operator asked, in the orchestrating session on 2026-09-22, whether a delegated vendor, after enough
time at `spot-check` with high confidence, could graduate further — a third, lighter-than-spot-check
supervision tier, or no independent check at all. When told this conflicts with an already-ratified statute
clause, the operator said:

> "Hummm we can file for later"

— i.e., record it, do not act on it now, do not reopen the ratification tonight.

## The conflict, stated plainly

`we:docs/agent/platform-decisions.md#delegation-trial-record-graduation` (ratified via decision `#3690`,
2026-09-21, "all five forks approved as prepared, no amendments") rule 7 says, in its own words:

> "the independent look gets shallower but never goes away... at every level the orchestrator reads the
> real diff and rules on it... The separate independent pass keeps full coverage and moves only in depth:
> a full independent review at `full`; at `spot-check`, the advisory floor shape."

`SUPERVISION_LEVELS` in `we:scripts/lib/provider-routing.mjs` (prototype branch) defines exactly two
values, `full` and `spot-check`, with no third.

So this proposal is not an unbuilt detail of an existing decision — taking it up would mean REOPENING and
AMENDING an already-ratified statute clause (rule 7), not preparing a new fork of an open question.

## What a future `/prepare-decision-item` pass would need to research

This card is filed, not prepared. It proposes no forks and no default — that is the future prepare pass's
job. That pass would need to research at least:

- What evidence bar, if any, would justify going below `spot-check` (e.g. what would the analogue of rule
  3's "trailing clean streak + positive control + clean most-recent trial" look like one rung lighter, and
  is a streak-based bar even the right shape for removing the independent look rather than just deepening
  provider trust).
- Whether "the independent look never goes away" (rule 7) was a considered floor for a specific reason
  worth preserving, or an unexamined default carried over from the `full`/`spot-check` pair as originally
  scoped — i.e., was a third tier ever actually considered and rejected during `#3690`'s preparation, or
  simply never on the table.
- The security cost of a fully-unsupervised delegated-agent path: what fails silently if the orchestrator's
  own real-diff read (rule 7's floor, independent of tier) is the *only* check left, and whether that read
  alone is sufficient without a separate juror pass at any confidence level.
- Whether this composes with, or contradicts, the repo-level `none` axis rule 6 already describes (rule 6:
  "a repo-level `none` is never overridden by any triple's level") — a third tier lighter than `spot-check`
  is a *triple*-axis change; does it interact with or bump into the repo-level axis in a way the existing
  composition rule doesn't anticipate.

## Status

**Filed for later per the operator, 2026-09-22. Do not action without the operator revisiting it.**

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after (owed by the future
   `/prepare-decision-item` pass, not this filing).
