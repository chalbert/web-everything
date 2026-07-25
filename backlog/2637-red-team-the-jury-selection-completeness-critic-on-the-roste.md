---
bornAs: x9kpvl3
kind: story
size: 2
buildQueued: true
parent: "2636"
status: resolved
blockedBy: ["2634"]
scope: ["we:scripts/lib/review-core.mjs"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-25"
dateResolved: "2026-07-25"
tags: []
---

# Red-team the jury selection: completeness critic on the roster pick

Make the jury *selection* itself trustworthy, not just the diff review. After the roster is picked (at prepare and again at open), run one cheap completeness critic — the adversarial "what failure axis is unguarded here?" pass — that red-teams the pick for a missed lens/method (e.g. it forgot a11y on a UI change, or perf on a hot-path edit). What it surfaces is added to the roster before the jury runs. Small, standalone: builds on the lens/method registry in `we:scripts/lib/review-core.mjs` and attaches wherever a roster is resolved. Depends only on the lens/method split.

## Progress

Landed in `we:scripts/lib/review-core.mjs` (pure, unit-tested through `we:scripts/lib/__tests__/review-core.test.mjs`):

- `critiqueRosterCompleteness({ roster, changedFiles | expectedLenses })` — the always-on deterministic backstop. Compares the roster's seated lenses against the lenses the subject earns (mandatory axes + touch-set perspective lenses) and returns every earned-but-absent lens as a gap (carrying its default grounding method + provenance + a reason). Empty roster (care `none`) → no gaps: it completes an existing roster, never conjures a jury.
- `buildRosterCritiqueMandate(...)` — the adversarial "what failure axis is unguarded here?" subagent mandate, catching the semantic misses no path-glob sees (a custom element authored as a script; a hot-path edit that earns perf on non-page grounds). Subagent names each gap by an exact `ROSTER_CRITIQUE_LENSES` id so it is foldable.
- `applyRosterCritique(plan, gaps)` — folds surfaced gaps back onto the plan via the F3 minimal-override path (`applyRosterOverrides` ADD), idempotent, non-mutating.

Roster resolution, rigor, aggregation, and verdict reducers are unchanged — this only makes the roster more complete before the jury fans out.
