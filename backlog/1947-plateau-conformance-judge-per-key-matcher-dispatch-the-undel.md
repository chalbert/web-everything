---
kind: story
size: 5
parent: "1294"
status: active
blockedBy: ["1965"]
dateOpened: "2026-06-28"
dateStarted: "2026-07-01"
tags: []
---

# Plateau conformance-judge per-key matcher dispatch (the undelivered #1847 half)

## Carry (batch-2026-06-29d parallel /workflow — lane WORKED, blocked by pre-existing plateau build-red)

**Progress: the cross-repo false-drop is GONE.** After syncing `plateau-app:origin/main` (it was 66 commits
behind local — the lane clones reset to `origin/main`, so they had been seeing a stale tree, the real root
cause of the 2026-06-29 false-drops), this run's lane clone saw
the real tree, did **correct** work (matcher dispatch in `plateau-app:src/conformance-engine/conformanceVectors.ts`
+ a new `.test.ts`), gated green in-lane, and pushed. It did **not** land only because the integrator's
**unscoped** `npm run build` on plateau-app was **already red for a pre-existing reason** (#1965 — entry imports
a deleted `@we` SimpleStore block), which has nothing to do with this item. Released `active→open`;
now `blockedBy: #1965`. Once #1965 makes the plateau build green, re-attempt (serial `/batch` is fine; the
lane work itself is proven). The impl is small and fully described above — just re-do it; the throwaway
`lane/batch-2026-06-29d-1947` refs were cleaned off the WE + plateau-app origins (no salvage needed).

The plateau conformance judge (plateau-app:src/conformance-engine/conformanceVectors.ts) still compares every non-special expect key with hardcoded strict equality (last[key] !== expected, ~lines 142-147) and never dispatches on the per-key matcher vocabulary #1847 defined. #1847 resolved but delivered ONLY the WE schema half (graduatedTo we:conformance-vectors/schema.ts); the Plateau judge half (treat 'matchers' as metadata; dispatch per-key exact / deep-equal / resolved-options-parts-structure / predicate) was never built, so any conformance suite whose vectors use a matcher fails ALL vectors with 'matchers expected {...}, observed undefined'. Cross-cutting: blocks the intl/analytics/reliability docs-page wirings (#1920/#1921/#1922) which need predicate/array comparison. Implement the dispatch in plateau-app:src/conformance-engine/conformanceVectors.ts, then the page-wiring slices become clean mirrors of #1801.

## Carry (batch-2026-06-29 parallel /workflow — lane FALSE-dropped, premise re-verified TRUE)

The `/workflow` cross-repo lane agent dropped this `outgrew`, claiming "the item's central premise is not grounded in the current plateau-app tree." **That verdict was wrong** — re-checked directly: `plateau-app:src/conformance-engine/conformanceVectors.ts:142-147` still does `if (last[key] !== expected)` (hardcoded strict equality, no matcher dispatch), exactly as the body describes. The premise holds; the work is real and un-done. Released `active→open` for a **serial** re-attempt. Root cause is the slice-4 (#1943) cross-repo machinery, not the item: this was one of two plateau-app (cross-repo) lanes and BOTH false-dropped on "doesn't exist / not grounded" while the WE-only lane (#1905) succeeded — the lane clones appear not to have had the plateau-app tree visible, so the agents concluded the code was absent. Re-run serially (`/batch`), not via `/workflow`, until the cross-repo lane provisioning is proven (#1153 watch).
