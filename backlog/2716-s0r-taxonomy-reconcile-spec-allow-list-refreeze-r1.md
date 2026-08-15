---
bornAs: x10x41m
kind: story
size: 1
parent: "2705"
status: resolved
scope: ["plateau-app:src/feature-tracker/feature-tracking.webcases.ts"]
dateOpened: "2026-07-27"
dateStarted: "2026-08-15"
dateResolved: "2026-08-15"
graduatedTo: "plateau-app:src/feature-tracker/feature-tracking.webcases.ts"
tags: []
---

# S0r · Taxonomy reconcile + SPEC allow-list refreeze (R1)

Reconcile the FT case taxonomy: verify every rendered=yes case maps to a real v3 baseline surface, freeze SPEC_BEFORE_RENDER at exactly 44, and rewrite the honest-forecast taxonomy line to the three-branch rule. Delivers #2709. Flip nothing new.

## Deliverable
Reconcile the FT case taxonomy and refreeze the SPEC allow-list (R1). Flip nothing new: VERIFY every `rendered=yes` case (all 71) now has a real baseline surface in the frozen v3 target, and freeze `SPEC_BEFORE_RENDER` at exactly the 44 spec cases. Rewrite the taxonomy's honest-forecast line to the §0 three-branch rule (velocity projection window / a real past date only on resolved+delivered / honest absence). No case stays `yes` without a baseline surface.

**Delivers #2709** (case taxonomy → webcases) — this and S0a are the build-slices of that story, not a duplicate.

## FT cases → rendered=yes
None — reconcile only (no new render).

## Scope
- `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` (flags only) + the taxonomy doc

## Acceptance
All 71 `yes` cases each map to a v3 surface; the spec set = exactly 44 (S17, F13–15, M8/M13/M22/M23/M32/M38, E2–16, L2–13, C1–3, R1–4); the list-only-shrinks assertion is added.

## Resolved (2026-08-15) — code already landed via plateau-app PR #115, status was stale

Found while reconciling this record: the deliverable was already built and merged weeks ago as `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` (plateau-app PR #115, commit `da66083`, "WE #2716: FT taxonomy reconcile + SPEC allow-list refreeze R1 (plateau-app)"). This card's own `status: open` was a stale bookkeeping gap, not outstanding work — surfaced during `we:backlog/2693-*.md` prep, which filed `we:backlog/3131-*.md` for the fix.

Re-verified independently against every acceptance clause at plateau-app HEAD before flipping status:
- `SPEC_BEFORE_RENDER` freezes exactly the 44 named codes (S17, F13–15, M8/M13/M22/M23/M32/M38, E2–16, L2–13, C1–3, R1–4) — `SPEC_COUNT = 44`.
- `RENDERED_COUNT = 71`; `FT_CASES` derives `rendered` as the structural complement of the allow-list, so every `yes` maps to a real v3 surface by construction.
- `validateFtRegister()` enforces the 71+44 partition (reconcile) and that the actual spec set is a subset of the frozen allow-list (list-only-shrinks), and runs at module load.
- The honest-forecast line is rewritten to the §0 three-branch rule (`FT_FORECAST_RULE`: projection window / real past date only on resolved+delivered / honest absence).

All acceptance clauses hold in landed code. No rebuild needed — this is a mechanical status reconcile, `graduatedTo: plateau-app:src/feature-tracker/feature-tracking.webcases.ts`.
