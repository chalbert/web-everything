---
bornAs: x7l22sz
kind: decision
parent: "2676"
status: open
dateOpened: "2026-08-15"
tags: []
---

# Name the tier above feature (rollup basis: points vs outcome-metrics)

Split off #2690's prep (2026-08-15): #2690 ("generalize the rollup tree to N levels + a program/portfolio
zoom above feature") names this exact fork in its own body as an **open question** — "name the tier above
feature — a PROGRAM (a delivery grouping of features, rolls up points) vs an INITIATIVE (a time-boxed bet)
vs an OKR OBJECTIVE (an outcome the features serve, rolls up outcome-metrics not points)" — and per the
story-preparation checklist (`we:agent-memory-src/story-preparation-checklist.md` item 4) a real fork must
be NAMED as its own open decision, never handed to a builder buried inside the story. This item is that
decision, mirroring the sibling split already done for #2689 (configurable hierarchy levels) out of the
same feature-tracking-screen design session.

## Why this isn't cosmetic

The choice changes the DATA CONTRACT the rollup renders, not just a label:

- **PROGRAM** — a delivery grouping of features. Rolls up the same unit every lower tier already rolls up:
  **points**. The rollup/velocity/forecast primitives generalize with zero new shape.
- **INITIATIVE** — a time-boxed bet, not a point-rollup container. Would need its own "how much of this bet
  is done" measure, which may or may not be points.
- **OKR OBJECTIVE** — an outcome the features serve. Rolls up **outcome-metrics**, not points — a genuinely
  different aggregation (no natural "sum of points" semantics across features serving one objective), and a
  different honest-forecast story than the velocity-derived one #2718 built for points.

Whichever name wins, the rollup/read-model interface for the tier above feature (what a "program/initiative/
objective" node exposes upward — points total, or a metric, or both) follows from this call. Deciding it
after the tier is coded risks exactly the rework the checklist exists to prevent.

## Recommendation (for the eventual ratification, not pre-decided here)

PROGRAM is the shape that costs nothing new: it reuses the existing points-rollup, velocity (#2686), and
forecast (#2718) primitives verbatim, so "the tree generalizes upward with zero new visual language" (as
#2690 already claims) stays true at the DATA layer too, not just the visual one. INITIATIVE and OKR
OBJECTIVE both require a second, non-points aggregation the rollup does not have yet — that is real new
scope, not a naming choice, and would need its own primitive story before a tier above feature could render
it honestly.

## Blocks

#2690 cannot be prepared past this fork — its rollup/velocity/forecast interface for the new tier depends on
the answer.

## Correction (2026-08-15)

Both `#2687` mentions above originally cited the standalone WE-side forecast-primitive story, which
`#3125` resolved `status: resolved` (superseded) the same day — reference updated to `#2718` (S1a,
`plateau-app:src/feature-tracker/forecast.ts`), the card that actually delivers the forecast primitive per
`#3125`'s ruling.
