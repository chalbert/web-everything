---
bornAs: xxj54sw
kind: story
size: 5
parent: "2612"
status: resolved
scope:
  - we:scripts/readiness/couple-plan.mjs
  - we:scripts/readiness/__tests__/couple-plan.test.mjs
  - we:scripts/lane-stack.mjs
  - we:scripts/__tests__/lane-stack-e2e.test.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/lane-resume.mjs
  - we:scripts/__tests__/lane-resume.test.mjs
  - we:scripts/lib/rebase-drop-manifest.mjs
  - we:scripts/lib/__tests__/rebase-drop-manifest.test.mjs
dateOpened: "2026-07-26"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Couple concurrency: overlap-open both PRs, guarded fast-forward skip of WE re-CI

Cut the cross-locus couple's CI tax without weakening the review invariant or the impl-first/WE-last merge order.
Two parts: a **robust** half — open both the impl and WE PRs concurrently so their **first** CIs overlap instead
of serializing; and a **conditional** half — skip the WE half's post-impl-land re-CI **only when** it is provably
a clean fast-forward. Today the WE half goes `BEHIND` after impl lands, the drain rebase-drops it, and the rebuilt
tip **re-runs `test`** and lands a pass later — a whole second CI cycle. The merge ordering
(`we:scripts/merge-ai-prs.mjs` `planLabelDrain`) is unchanged; only the *CI* stops being serialized.

## The guard (design jury: the old "no second CI" claim was false in steady state)

The jury showed a naive overlap-stack re-incurs the exact tax it removes — because the fast-forward assumption
breaks in the common cases. So the skip is **gated**, with a clean fallback:

- **Skip the WE re-CI only when** the landed impl SHA **equals** the SHA the WE half was overlap-stacked on
  (`stackParents`, #2393) **and** `main` has not advanced past it. Otherwise **fall back to today's rebase +
  re-CI** — no silent untested fast-forward.
- **Squash-merge** changes the impl SHA → the guard trips → fallback (never assume byte-identical land).
- **Impl `review:changes` bounce** (a *normal* outcome of the mandatory non-author sign-off) supersedes the
  stacked base → re-stack or fall back; never land the WE half against a stale impl.
- Keep the per-diff review **crisp**: the WE reviewer signs off on the **WE delta**, not an impl+WE blur.

## Definition of done

- A pure `we:scripts/readiness/couple-plan.mjs` (or equivalent) decides open-order + stack-base + the
  skip-vs-rebase verdict from injected SHAs; unit-tested.
- Both PRs open before either lands (parallel first CI); the drain's impl-first/WE-last land order is untouched.
- No configuration in which the WE half lands on a base its CI never validated — the guard is fail-safe to rebase.

## Scope note (file-level rescope, #2619 finer-lease)

Narrowed from the whole `we:scripts/readiness/` dir to the specific couple machinery: the new pure planner
`we:scripts/readiness/couple-plan.mjs` (+ test); the overlap-open wiring in `we:scripts/lane-stack.mjs` (the
#2393 overlap-stacking CLI that opens both PRs before either lands); the drain consumer `we:scripts/merge-ai-prs.mjs`
(which reads the skip-vs-rebase verdict — its `planLabelDrain` *ordering* is unchanged, but the re-CI *decision*
is edited); the BEHIND/rebase fallback path `we:scripts/lib/rebase-drop-manifest.mjs`; and `we:scripts/lane-resume.mjs`
(stuck-couple takeover). This is genuinely couple-machinery-wide but no longer leases the entire 30-file
`we:scripts/readiness/` dir, so it stops colliding with sibling readiness items (e.g. #2661's
`we:scripts/readiness/conveyor-state.mjs`). Each named file carries its own test file in scope (an edit to a
`*.test.mjs` outside scope would breach).

**Savings are best-case, not headline:** the robust win is the overlapped first CIs (always); the FF-skip is an
opportunistic bonus when the stack base is still main's tip. The earlier −48% figure is withdrawn as best-case.

## Round-2 review — acceptance criteria

- **The overlap-CI win is NOT unconditional.** The WE PR is stacked on impl, so an impl `review:changes` bounce
  (which the guards above call the *norm*) moves the stacked base and **discards the WE half's first CI** — the
  same event that guts the FF-skip. So the "robust, always-true" framing overstates it: quantify B's benefit
  against the **observed impl-bounce rate** (from #2680), and treat the overlapped first CI as a win *conditional*
  on impl not bouncing, not a guarantee.

## Progress

- **Pure planner shipped** — `we:scripts/readiness/couple-plan.mjs` (unit-tested). `planCoupleOpen` decides the
  overlap-open order (impl-first / WE-last) + the WE half's stack-base; `decideWeReCi` is the GUARDED
  skip-vs-rebase verdict. It is **fail-safe to `rebase`**: it returns `ff-skip` ONLY on positive proof of a
  clean fast-forward (landed impl sha == the sha the WE half stacked on == current main). Squash-merge,
  `review:changes` re-stack, main-advanced, or any missing/malformed sha all fall back to rebase + re-CI. This
  module is the single source of truth (#96) for the decision — no config lands the WE half on a base its CI
  never validated (DoD 3).
- **Drain realizes the guard in git, and tags the regime** — in `we:scripts/merge-ai-prs.mjs` the guard is
  ALREADY enforced by the existing rebase-drop machinery: a stacked WE half whose impl landed as a clean
  fast-forward is on current `main` → `current` → lands on its first CI, no re-CI (the FF-skip win); a
  superseded base (squash / `review:changes` re-stack / main advanced) makes it BEHIND → `rebased` → rebuilt +
  re-CI (the fail-safe). The re-CI *decision* is thus the existing `current`-vs-`rebased` outcome — no override
  is added (an early attempt to force a rebuild from the *recorded* manifest base was a review-caught bug: the
  recorded base ≠ the tip's location after any prior-pass rebase, so it would permanently skip valid, CI-current
  halves). The only #2684 edit is a zero-control-flow-change observability tag (`v.coupleReCi = 'ff-skip'|'re-ci'`
  via the unit-tested pure `isStackedWeCoupleHalf`) plus a drain-log annotation. `planLabelDrain` merge ORDERING
  is untouched (DoD: only the *CI* is de-serialized).
- **Overlap-open seam shipped** — `we:scripts/lane-stack.mjs couple-open` is the stateless mechanical boundary
  that resolves the impl lane's pushed tip to a pinned sha and hands it to `planCoupleOpen` (e2e-tested against
  real git). It emits the open-order + WE stack-base the couple opener needs.
- **Deferred (out of #2684's file-scope):** actually opening the WE PR *stacked on the impl tip* lives in the
  couple opener `we:scripts/pr-land.mjs`, which is **not** in this item's scope. Filed as **#xsk6c44**
  (`blockedBy: 2684`, under #2612): wire `pr-land` to shell `lane-stack couple-open`. The decision logic and the
  drain-side guard delivered here are forward-compatible and fire the moment that wiring lands.
