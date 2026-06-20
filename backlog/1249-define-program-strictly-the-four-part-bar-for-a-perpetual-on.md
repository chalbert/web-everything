---
kind: decision
status: resolved
dateOpened: "2026-06-20"
dateResolved: "2026-06-20"
codifiedIn: "docs/agent/backlog-workflow.md#program-definition"
tags: []
---

# Define 'program' strictly — the four-part bar for a perpetual ongoing epic

Ratified definition of a backlog 'program': a standing effort guarding a goal that is never done because the world keeps moving. Hardens the soft ongoing:true flag into a four-part conjunctive Program Test (standing goal + conformance front + currency front + cadence), with watch mode as a real lifecycle state and an L0->L2 maturity ladder. 'Evergreen' is the property a program maintains. Codified in we:backlog-workflow.md#program-definition.

## Ruling (ratified 2026-06-20)

A **program** is the hardened form of an `ongoing: true` epic. A line of work is a program **iff all four hold** (conjunctive — fail one and it is an epic / theme / tool):

1. **Standing goal, no Definition of Done** — resolving every current child would not end it; "done" is a pass-through *watch* state, never the terminus.
2. **Conformance front (internal)** — a named metric ("are we green vs the known target?") + a mechanism that re-checks it.
3. **Currency front (external)** — a named external-delta signal ("has the world moved so the target is stale?": competitor / new tech / new research) + a **discovery method** that files new items to keep the goal current. Must be runnable by hand; automation is a later stage.
4. **Cadence** — a defined trigger per front (drift / external signal / schedule).

Supporting rulings folded in:
- **Watch mode is a real lifecycle state** — a program legitimately sits `open` with zero open children between deltas (the inverse of the resolved-looking-epic smell); this is what `ongoing: true` already encodes.
- **Maturity ladder L0 → L1 → L2** (manual → skill-assisted → scheduled). Front-A metric must be **definable at L0, must exist to graduate past L0** — the one residual, settled this way to keep young programs admissible without softening the bar.
- **"Evergreen" = the property; "program" = the noun that maintains it.** [#099](/backlog/099-evergreen-app-vision/) is the full two-front archetype (currently L0/aspirational); the exercise-app loop [#314](/backlog/314-flagship-exercise-apps/) is a front-A-only program (the conformance-front reference).

## Lineage

Opened, discussed, and ratified in one session (2026-06-20). The definition grew by accretion: 4-part test → split front A into conformance + currency (external "watch mode" for competitor/tech/research) → maturity ladder (manual-then-automatic discovery) → "evergreen = ever-improving" as the canonical instance. Worked-example placement (#314 front-A-only vs #099 full archetype, labelled aspirational) chosen to avoid an aspirational example reading as a passing one.

Codified in `we:docs/agent/platform-decisions.md#program-definition` (statute pointer) → `we:docs/agent/backlog-workflow.md#program-definition` (canonical text). Hardens the pre-existing `ongoing: true` rule rather than adding a new `workItem` kind. Reversible with lineage per the standing reversibility rule.
