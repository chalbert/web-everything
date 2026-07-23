---
bornAs: xtkdu9s
kind: story
size: 8
parent: "2612"
status: resolved
scope: ["we:scripts/readiness/", "we:skills-src/conveyor/"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-23"
dateResolved: "2026-07-23"
tags: []
---

# Conveyor: prepare open decisions and present the forks — artefact (chat) + #2565 ruling surface (UI)

The conveyor today only drives story delivery. Decisions are ignored entirely. This item extends the conveyor to also prepare open decisions and present their forks, so the conveyor drives the whole backlog lifecycle — deliver + slice + decide.

## Problem

Decisions are excluded from buildable work. In [we:scripts/readiness/engine.mjs](scripts/readiness/engine.mjs), `isBuildable = kind !== 'decision'`, so the conveyor never touches a `kind:decision` item. An open decision that is ready to be prepared and ratified just sits there — the autonomous loop can deliver and (with sibling item 2645) slice, but it can never move a decision forward.

## Proposed behavior

Extend the conveyor to drive decisions in two steps:

1. **Prepare** an open decision — research plus author its forks to "ready to ratify", mirroring the [we:skills-src/prepare-decision-item/](skills-src/prepare-decision-item/) `/prepare` skill.
2. **Present** the forks in two surfaces:
   - a published **artefact** in the chat / main-session conveyor (the conversational surface); and
   - the already-built **#2565 console decision-ratify (ruling) surface** for the product/UI conveyor. The ruling read/write ports (#2580 / #2581 / #2582) already exist; this item wires the autonomous feed into them.

Goal: the conveyor drives deliver + slice + decide, not just story delivery.

## Progress

Delivered the WE-side core (scope: `we:scripts/readiness/`, `we:skills-src/conveyor/`), mirroring the epic →
`needs-slice` pattern (#2645) one `kind` over:

- **Dispatch** (`we:scripts/readiness/dispatch-plan.mjs`): a cleared `kind:decision` is held **`needs-decision`**,
  checked BEFORE the scope gate — so it is never mislabeled `unshaped-no-scope` and aimed at a scope-prediction
  agent (a decision has no build touch-set). Added to `HELD_REASONS` + a `NEEDS_DECISION_HINT` operator gloss.
- **State** (`we:scripts/readiness/conveyor-state.mjs`): new **`state.decisions`** channel (`deriveDecisions`) —
  armed `kind:decision` rows carrying `{ num, prepared, preparedDate }`; `deriveUnshaped` now excludes decisions
  (mirroring its epic exclusion); rows enriched with `prepared`/`preparedDate`.
- **Skill** (`we:skills-src/conveyor/SKILL.md`): new **§3e** — route each `state.decisions` row by `prepared`:
  UNPREPARED → spawn a prepare-decision agent; PREPARED → **present** its forks (a published chat artefact +
  the #2565 ruling surface) and surface for `/next decision`. Ratifying stays human (surface, never auto-ratify).
- **Agent brief** (`we:skills-src/conveyor/prepare-decision-agent-brief.md`): NEW — instantiates the `/prepare`
  (`prepare-decision-item`) method inside the conveyor's background-agent arc (acquire lane → prepare-hold →
  research + author forks + skeptic + screen → prepare-stamp → review to convergence → one PR → prepare-release
  → exit without merging).
- **Tests** (`we:scripts/readiness/__tests__/`): `dispatch-plan` + `conveyor-state` suites extended
  (needs-decision holds, decision-before-scope-gate, `deriveDecisions`, unshaped excludes decisions). Verified
  live: two cleared decisions route to `needs-decision` / `state.decisions` with the correct `prepared` flag,
  neither leaking into `unshaped`.

**Split out** (cross-locus, out of WE scope): the autonomous feed that wires a PREPARED decision's forks into the
already-built #2565 console ruling surface via ports #2580/#2581/#2582 lives in the impl repo, so it was carved
to follow-up **#xtzhhcu** (blockedBy #2647) rather than half-done here. The WE side presents via the chat
artefact today; the console feed lands under #xtzhhcu.
