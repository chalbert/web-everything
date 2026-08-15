---
kind: decision
size: 1
parent: "2555"
status: open
locus: plateau-app
dateOpened: "2026-08-15"
preparedDate: "2026-08-15"
tags: [plateau-loop, console, console-board, scope-lease, card-taxonomy, canonical-2554]
---

# Extend §6e — mint UC-A16, the escalated scope-breach amber Resolve card

[#2797]'s prep found the escalated (`policy=park`, retry-bound exhausted) scope-breach case has no home in the
RATIFIED 37-state / 17-you-act-verb `§6e` taxonomy (`plateau-app:docs/backlog-console-design.md` §6e,
`we:scripts/readiness/scope-lease.mjs:326-358 breachOutcome`'s `'park'` branch). §2574's own Fork 4 already
rules that "any change to the count is a *separate* decision that supersedes §6e with lineage — never an edit
folded into A4's transition table." This settles the one open fork Fork 4 anticipated but did not itself
decide: which UC-id and grammar the escalated card gets. Ratifying this unblocks [#2797]'s build.

## Fork — mint a new UC-id vs. reuse an existing one

**Fork-existence:** a real either/or on where the escalated-breach amber card lives. Either it gets its OWN
UC-id (extending the taxonomy to 38 states / 18 you-act verbs) or it reuses an existing you-card's UC-id
(no count change). Both cannot be the default: the taxonomy's actor/edge/primary grammar is bound 1:1 to a
UC-id (`plateau-app:src/backlog-view/card-state-read-model.ts:302-311` — `deriveCardState` looks up `actor`
purely from the static `ACTOR_BY_UC[uc]` table, `plateau-app:src/backlog-view/card-state-read-model.ts:260-267`),
so one UC-id cannot carry two different (title, verb, glyph) pairs for two different live causes.

- **(a — recommended) Mint a new UC-id (`UC-A16`).** A dedicated state: title "escalated — scope breach",
  `actor=you edge=amber primary=Resolve rendered=yes uc=UC-A16`, distinct from A4's agent/no-amber default
  the same way A13 ("gap found — policy: ask") is distinct from A4/A9. **Merit:** matches the taxonomy's own
  established pattern — every other "only-under-policy=ask/park" promotion already gets its own dedicated
  card (A13 for the gap-policy case) rather than overloading an existing one's meaning; keeps the card's
  headline honest (an operator sees "escalated — scope breach", not a borrowed "gap found" or "built —
  parked for review" label that means something else). **Cost:** a mechanical taxonomy-count bump, touching
  the ~6 hard-coded `37`/`17` conformance assertions already found live at
  `plateau-app:src/backlog-view/card-state-read-model.test.ts:85`,
  `plateau-app:src/backlog-view/card-taxonomy.webcases.test.ts:69,111,278,323`,
  `plateau-app:src/backlog-view/card-taxonomy-docs.test.ts:26,76`, and
  `plateau-app:src/backlog-view/lane-board.test.ts:617` — the exact ripple Fork 4 flagged as needing lineage
  before a story silently trips it.
- **(b) Reuse UC-A13's grammar (or UC-A6's).** No count change. **Merit: none that survives.** UC-A13's own
  webcase text is scoped to "a decision (or slicing) discovered mid-build" — a DIFFERENT live cause (a
  planning gap, not a lease breach); rendering a scope-breach escalation under A13's title would misreport
  the card's own reason to the operator, the exact "decorative/misleading state" failure mode the risk
  taxonomy (`we:backlog/3103-*.md`) names. UC-A6 ("built — parked for review") is post-build/PR-parked, not
  mid-build — reusing it would misreport an in-flight card as already built.

**Default: (a) mint UC-A16.** Consistent with the one precedent already in the ratified taxonomy (A13
alongside A4/A9) and with `breachOutcome`'s own three-way branch (`pause`→hands off to the existing B2/B3/B8
cross-lane family, no new state; `resolve-at-drain`→stays UC-A3 building, no new state; `park`→is the ONLY
branch with no existing home).

*Rejected:* (b) reuse — merit-disqualified by misreporting the card's cause to the operator.

## Proposed grammar (seed for the established rating method, not a final call)

The design doc's own **Method note** (`plateau-app:docs/backlog-console-design.md` §6e) rates every
glyph/motion/verb-glyph fork 1–5 across four lenses (Usability · Visual · A11y · Systems) before ratifying —
that process, not this decision, makes the final token picks. Seed proposal for that pass:

- **Card glyph:** `octagon-alert` (reuse A4's — same "shared glyph, distinct case" precedent as A9/A13's
  shared `help`, since this IS A4's own escalated form).
- **Motion:** `shake` (matches A4's `motion=shake`, the family's convention for a paused/interrupted state).
- **Verb:** `Resolve` (per [#2797]'s own naming — the operator's action is *choosing among the escalation
  ladder's routes*, `we:scripts/readiness/scope-lease.mjs:290-299 BREACH_ESCALATION_LADDER` rungs 1–3: widen
  the lease / hand off cross-lane / bounce-quarantine).
- **Verb glyph:** `split` (reuse A13's — both verbs open a route-choice menu over several named branches).

## Context

- **Lineage:** required by `plateau-app:docs/backlog-console-design.md` §3i-A4 Fork 4 (WE decision #2574,
  ratified 2026-07-20): "§6e is settled... any change to the count is a separate decision that supersedes
  §6e with lineage." This item IS that lineage'd decision, scoped ONLY to minting the one state Fork 4 left
  unassigned — it does not reopen any of #2574's four forks.
- **Constellation:** `locus: plateau-app` — product business logic on the console card taxonomy, mirroring
  #2574's own locus. No WE standard entity, no Intent/conformance story.
- **Downstream:** ratifying (a) unblocks [#2797]'s wiring build — the new UC-id, once it exists in
  `plateau-app:src/backlog-view/card-taxonomy.webcases.ts`, is what [#2797]'s live-signal wiring targets.

## Ruling

_Open — awaiting ratification._
