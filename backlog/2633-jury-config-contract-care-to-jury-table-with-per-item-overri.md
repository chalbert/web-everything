---
bornAs: x458es8
kind: story
buildQueued: true
parent: "2636"
status: resolved
scope: ["we:scripts/lib/review-policy.contract.json", "we:scripts/lib/review-policy.mjs"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-24"
dateResolved: "2026-07-24"
tags: []
---

# Jury config contract: care-to-jury table with per-item override

The foundation slice. Extend `we:scripts/lib/review-policy.contract.json` with the care→jury table — per care band: which lenses fan out, which validation methods each pulls in, `jurorsPerLens`, and the `roundCap` (max round-trips before deadlock→human). Add the roster-timing-mode field (knob #4). Extend `validateContract` in `we:scripts/lib/review-policy.mjs` to cover the new shape. The contract is statute/gate-self (a human edits the review leash); an item file may carry only *overrides*, same pattern as `scope:`. This single-sources today's hardcoded `panelRigorForCareLevel` bands (`we:scripts/lib/review-core.mjs`) so a re-tune is one human-gated edit, not scattered constants.

## Progress

Done (contract layer only — scope: `we:scripts/lib/review-policy.contract.json` + `we:scripts/lib/review-policy.mjs`):

- **Care→jury table** added to the contract under `careJury.bands`, one object per care band (`none`/`low`/`elevated`/`high`), each declaring `lenses`, per-lens `methods`, `jurorsPerLens`, `roundCap`, and prose. Band values for lenses/jurors/rounds are set to EQUAL today's `panelRigorForCareLevel` literals.
- **Roster-timing-mode** (knob #4) added as `careJury.rosterTimingMode` (`bind-at-open` default; `bind-at-prepare` the strict alternative).
- **`validateContract`** extended to cover the new shape (bands cover exactly the care levels; every fanned-out lens carries at least one method; methods never name a non-fanned lens; non-negative-integer knobs; prose required). Lens/method TOKENS validated for shape only (not enum-frozen) so #2634 can add a11y/visual/perf lenses+methods without editing the validator.
- **Accessors + oracle + override:** `POLICY_CARE_JURY`, `POLICY_ROSTER_TIMING_MODE`, `deriveCareJuryRigor()` (the executable oracle the conformance suite holds `panelRigorForCareLevel` to), and `resolveCareJuryConfig(careLevel, override)` — the per-item override merge (allow-list `CARE_JURY_OVERRIDE_KEYS`, loud reject on any other key; the `scope:` pattern).
- **Conformance** extended in `we:scripts/lib/__tests__/review-policy.conformance.test.mjs` (policy-tier protected): proves the contract bands equal `panelRigorForCareLevel` over every care level, and covers the override merge.

Forward-fit (#2651, NOT built here): bands are objects and `careJury` is an object, so per-lens weights, a dissent-tolerance threshold, and the accept-best↔present-unless-all-agree aggregation setting are additive later — no migration.

Deferred to consumers: rewiring `panelRigorForCareLevel` (`we:scripts/lib/jury-core.mjs`) to import from the contract is the resolver spine (S3 #2655); the a11y/visual/perf method registry is #2634. Both are blockedBy #2633 and out of this slice's scope.
