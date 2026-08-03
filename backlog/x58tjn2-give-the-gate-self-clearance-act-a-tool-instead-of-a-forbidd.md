---
kind: story
size: 2
status: open
blockedBy: ["2882"]
relatedTo: ["2285", "2439", "2644"]
scope:
  - we:scripts/review-set-label.mjs
  - we:skills-src/review/SKILL.md
  - we:scripts/__tests__/review-set-label.test.mjs
dateOpened: "2026-08-03"
tags: [review, gate, invariant, gate-self]
---

# Give the gate-self clearance act a tool instead of a forbidden raw command

The review skill says a human clearing a gate-self PR should drop `review:human` as a separate stated act, but no CLI target removes it and the only raw spelling is forbidden by the skill's own gate — so the sanctioned act has no sanctioned way to perform it.

## The dead end

#2882 routed `/review`'s verdict swap through `we:scripts/review-set-label.mjs` and added a `check:standards` rule forbidding a hand-rolled review-label edit in that file. Both are right. But they close a door that was the only way through:

- `decideSetLabel` has three targets — `accepted`, `changes`, `rearm`. None removes `review:human`, and `accepted` is REFUSED on a `review:human` PR (INVARIANT 2, correctly).
- The skill tells the operator to "drop `review:human` deliberately as a separate, stated act".
- The only way to do that is a raw label edit — which #2882's own gate now errors on, in that same file.

So the one act the `review:human` tier exists to enable — a human, and only a human, clearing a gate-self edit — is the one act with no tool. In practice that pushes the operator to an unrecorded command typed outside the flow, which is exactly the attribution loss the single home was built to prevent.

## Why it deserves a target rather than an exception

Clearing a gate-self PR is the highest-consequence act in the review system, so it is the one that most needs a durable, attributed record: who cleared it, against which tree, with what stated reason. A raw `gh` call produces none of that. Routing it through the module gets the `reviewed-sha` stamp and the comment for free, and turns "the operator promised to state it" into "the tool recorded it".

The design question the item must answer, not assume: is this a new `--to` target (say `clear-human`), or a flag on `accepted` (`--clear-human`) that lifts INVARIANT 2 for this one invocation? The flag form keeps one accept path and makes the lift explicit at the call site; the target form keeps `accepted` unconditionally refused on a gate-self PR, which is easier to reason about and harder to pass accidentally. Lean to the target, but decide it rather than default it — a member added to a single-sourced decider is hard to remove later.

Either way the refusal must stay unbypassable for everything else: an agent must never reach this path (#2439/#2285), so the tool needs an actor signal it cannot forge, or it is just the raw command with better manners. That constraint is the substance of the item.

## Definition of done

- A human can clear a gate-self PR entirely through `we:scripts/review-set-label.mjs`, producing the label change, the `reviewed-sha` stamp, and an attributed comment stating the clearance.
- The chosen shape (new target vs flag on `accepted`) is recorded with its reasoning, not just implemented.
- INVARIANT 2 remains refused on every other path; a test pins that the new path cannot be reached by the auto-review/agent callers.
- `we:skills-src/review/SKILL.md` names the tool instead of describing an act it forbids the reader from performing.
