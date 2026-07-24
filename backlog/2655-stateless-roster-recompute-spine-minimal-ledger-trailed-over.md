---
bornAs: xwrsimd
kind: story
size: 5
parent: "2649"
status: resolved
blockedBy: []
scope: ["we:scripts/lib/"]
dateOpened: "2026-07-24"
dateStarted: "2026-07-24"
dateResolved: "2026-07-24"
tags: []
---

# Stateless roster-recompute spine + minimal ledger-trailed override (F3)

Pure roster = f(care, touch-set) recompute reading the #2633 care→jury table, generalizing scoreEscalation off PR-path-patterns onto a subject-supplied signal; plus a minimal override layer recorded as ledger events (S2 schema). The F3 resolver-spine.

## Progress

Landed in `we:scripts/lib/jury-core.mjs` (subject-agnostic core):

- **`resolveRoster({ careLevel, touchLenses, resolveMethods })`** — the stateless spine. `roster = f(care-level, touch-set)`: reuses `panelRigorForCareLevel` for the care band's static lenses + rigor dial (from the #2633 care→jury table), merges the subject-supplied `touchLenses` signal (care band wins overlaps, static-first order), attaches grounding methods via an injected resolver, and records `attachedBy` provenance. Generalizes the PR-path-pattern touch-set onto an abstract signal — subject-neutral, knowing nothing about what is judged.
- **Minimal override layer** — `ROSTER_OVERRIDE_OPS` (add/remove one lens) + `applyRosterOverrides(plan, overrides)`: a pure, idempotent overlay on top of the recompute (the overrides are the only persisted delta; the base is re-derivable).
- **S2 ledger bridge** — `materializeRoster` (expand seats → `jurorsPerLens` jurors) + `rosterPickedEvent` (emit a schema-valid #2654 `roster-picked` event carrying the effective, post-override roster) — so the override is ledger-trailed.

Refactored `we:scripts/lib/review-core.mjs` `resolveJuryPlan` to **delegate** to `resolveRoster` (supplying the PR-diff-specific touch-set signal via `classifyTouchSet` + its method resolver) rather than re-implementing the merge — byte-identical behaviour, existing #2634 tests green. New tests in `we:scripts/lib/__tests__/jury-core.test.mjs`.
