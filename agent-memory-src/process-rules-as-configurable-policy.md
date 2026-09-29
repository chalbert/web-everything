---
name: process-rules-as-configurable-policy
description: Every delivery/process rule we adopt (prepare depth, MVP cut, review-blocking classes/rounds, scope budget, test strategy, soak/replay requirement, live-proof gate, draft ownership, capacity caps, model/provider routing, specialist roles, postmortems, telemetry) is a configurable POLICY DIMENSION with named options — layered defaults → org/project → risk → card — never a hard-coded rule; the chosen policy rides on every run so run rating can compare policies.
metadata:
  type: feedback
---

**Every delivery/process rule this repo adopts is a POLICY DIMENSION, not a hard-coded rule.** Operator
direction, 2026-09-28 ("think about how this could be made product shape where all angles can be configured"):
prepare depth, the MVP-cut discipline ([[story-preparation-checklist]]'s own items 11-13), which plan-review
finding classes block a stamp and how many review rounds are allowed, scope/size budgets, test strategy (local
vs. CI, [[docs/agent/platform-decisions.md#local-gate-never-full-suite-by-default]]), the soak/replay
requirement, the live-proof gate ([[failure-is-a-product-improvement]]), draft ownership (`we:backlog/4364`'s
own author-owns-until-promoted ruling), capacity caps, model/provider routing and probation
(`we:scripts/lib/provider-routing.mjs`, `we:scripts/lib/model-probation.mjs`), specialist roles
(`we:backlog/4361`, `xs57vx3`), postmortems (`we:backlog/4365`'s conflict-postmortem store), and telemetry —
each of these is a NAMED dimension with a small set of NAMED options and a stated default, layered
**defaults → org/project → risk (care level) → card**, never buried as an unnamed `if` in one script or one
paragraph of prose. The chosen policy is recorded on every run so run rating (`we:scripts/conveyor/run-rating.mjs`)
can compare outcomes ACROSS policies, not just across cards.

**Why now, not earlier.** This repo has been adding exactly these rules one at a time, each as its own
hard-coded default buried in its own file or memory entry (the MVP-cut rule itself, `we:agent-memory-src/story-preparation-checklist.md`'s
items 11-13, is one more instance of the SAME pattern this item now names). Ties to epic `we:backlog/4305`
(`xg2nk4l`, "configurable/combinable delivery and testing strategies") and the role registry card
`we:backlog/4361` (`xs57vx3`) — both are dimension-shaped asks already filed; this item is the ONE place that
names the pattern itself, so the next rule we adopt is authored as a dimension from the start rather than as
another one-off default someone later has to retrofit.

**Constellation placement (unchanged from the existing rule, #96):** WE holds the standard — the dimensions,
their allowed options, the schema, a validator — no engine. Frontier UI holds the engine that reads the policy
and drives behavior from it. Plateau is the product — a settings UI per project to SET the policy, `/wip`
showing which policy each item ran under, and a policy-comparison view.

**MVP first, not the whole stack at once:** gather today's scattered rules into ONE policy file the daemons
read (a single schema-shaped document naming each dimension + its current option), before building the
schema/standard package, the validator, or any Plateau UI — those come later, once real daemons are actually
reading real policy instead of a hard-coded default. This mirrors [[story-preparation-checklist]]'s own new
MVP-cut item: state the full design, then build only the smallest slice that lets today's rules be read from
one place.

**How to apply:** when proposing or building any NEW process rule (prepare depth, a review-blocking class, a
capacity cap, a routing default — any of the list above, or a new one like it), name its dimension, enumerate
its options, state the default, and put the choice in the policy file — never hard-code it into the script or
bury it as unstructured prose in a memory entry with no machine-readable option name. Related:
[[fixes-need-prepared-card]] (the same "name it as a mechanism, not a private judgment call" instinct, applied
to the fix-dispatch path), [[story-preparation-checklist]] (the MVP-cut rule this item generalizes from), rule
51 (Hookable vs Judgment — whatever a script can decide belongs in a script, never in recall).
