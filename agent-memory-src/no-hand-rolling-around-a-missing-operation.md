---
name: no-hand-rolling-around-a-missing-operation
description: when work has no declared operation to call, build the operation (or fold the work into an existing one) rather than hand-rolling the steps by hand — explicit standing instruction, not just a one-off
metadata:
  type: feedback
---

Finding a gap where no declared operation exists is not licence to hand-roll the steps manually as a
one-off "just this once." The operator's explicit standing instruction (2026-08-17): "if you find work that
does not have an operation, I asked to create new ones or fold into an existing, no hand rolling."

**Why:** this repo's whole operations-engine thesis (#3029, statute
`docs/agent/platform-decisions.md#operations-declared-once-callers-generated`) is that a step done by hand
drifts from its declaration by construction — every hand-rolled repeat is a chance to diverge from what a
declared operation would enforce (input shape, gate checks, label/state consistency). [[check-skills-before-repeating-a-workaround]]
already covers the adjacent case (check whether a skill/operation exists before repeating a workaround this
session already used) — this rule is the stronger, prospective half: once a gap is CONFIRMED (no operation
covers this work), the right response is to build one or extend an existing one, not to keep hand-rolling
"until someone gets around to it." Concrete precedent already filed: `backlog/3172-declare-a-file-backlog-gap-operation-prove-it-for-one-use-ca.md`
(filing a backlog item itself — lane acquire, scaffold, author, commit, land, dispatch review — was hand-rolled
roughly a dozen times in one session before being identified as its own missing operation).

**How to apply:** when a task's steps have no declared operation in `scripts/operations/run.mjs` and no skill
wraps one either, don't just do the steps by hand and move on. Either (a) build the operation now if the gap
blocks real progress and is small enough to build in-session, or (b) file it as its own backlog item with real
Done-when criteria (matching the `file-backlog-gap` precedent's shape) and prioritize it, rather than treating
a hand-rolled workaround as an acceptable standing pattern. This applies broadly — not just to backlog filing,
the case that surfaced it.
