---
bornAs: x832chf
kind: story
size: 3
buildQueued: true
parent: "2636"
status: resolved
blockedBy: ["2634"]
scope: ["we:scripts/pr-land.mjs", "we:scripts/lib/review-escalation.mjs"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-25"
dateResolved: "2026-07-25"
tags: []
---

# Bind and reconcile the jury roster at PR-open against the real diff

At PR-open, recompute the jury roster from the **real diff** (`changedFiles`) and take the union with the pre-registered set from the charter — the predicted scope often misses an axis the actual diff touches (a "small script fix" that moves a UI file needs the a11y + visual jurors nobody picked). Selection is cheap (a scoring pass over the diff, the same `scoreEscalation` path in `we:scripts/lib/review-escalation.mjs`), so this re-pick costs almost nothing. Per the settled default, **roster expansion past what was pre-registered re-triggers human alignment** (not a silent rebind) and is flagged in the jury ledger. Wire into `we:scripts/pr-land.mjs` (the producer that already scores the rubric at open). Depends on the lens/method split.

## Progress

- `we:scripts/lib/review-escalation.mjs` — added the pure `reconcileRoster({ preRegistered, recomputed, mode })`: it takes the UNION of the pre-registered (charter) lenses and the real-diff recomputed lenses (pre-registered first, never silently dropping a seat), reports `added` (the expansion past registration), and — per the settled default — sets `humanAlignmentRequired` when the diff expands past pre-registration under the strict `up-front` timing (silent under `incremental`). `preRegistered == null` degrades to a pure bind (nothing to have drifted past). Added the `ROSTER_TIMING` enum mirroring the contract's `careJury.rosterTimingMode` value space.
- `we:scripts/pr-land.mjs` — wired the bind+reconcile into the producer at PR-open (the same `applyReviewEscalationLabel` path that already scores the rubric): `resolveRosterReconcile` recomputes the roster from the REAL net diff via `resolveJuryPlan(careLevel, changedFiles)` (care-level now surfaced from `resolveProducerReviewLabel`), reconciles against the pre-registered roster carried on the lane manifest (`preRegisteredLenses`, read defensively), and folds the result into the review label — an expansion past registration UPGRADES the label to `review:human` (never a silent rebind) and its reason is stamped into the PR body (where the #2641 jury ledger will read it). The bound roster + any expansion is surfaced in the producer's JSON result (`juryRoster` / `rosterExpanded` / `rosterAdded`).
- The roster-timing mode is read from the human-gated care→jury contract (`POLICY_CARE_JURY.rosterTimingMode.value`), never hardcoded.
- Tests added to `we:scripts/lib/__tests__/review-escalation.test.mjs` and `we:scripts/__tests__/pr-land.test.mjs`; `check:standards` + full suite green.
- Follow-up (sibling scope, not this slice): the prepare-time CARRIER that records the charter roster onto the lane manifest (`preRegisteredLenses`) — the `we:scripts/readiness/lane-manifest.mjs` schema key + the prepare step — is owned by the "jury pre-registered at prepare" work under epic #2636; until it lands, the re-alignment re-trigger is correctly dormant (pure bind) while the mechanism ships fully unit-tested.
