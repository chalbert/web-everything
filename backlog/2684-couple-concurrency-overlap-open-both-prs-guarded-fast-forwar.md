---
bornAs: xxj54sw
kind: story
size: 5
parent: "2612"
status: open
scope: ["we:scripts/lane-resume.mjs", "we:scripts/readiness/", "we:scripts/lib/rebase-drop-manifest.mjs"]
dateOpened: "2026-07-26"
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

**Savings are best-case, not headline:** the robust win is the overlapped first CIs (always); the FF-skip is an
opportunistic bonus when the stack base is still main's tip. The earlier −48% figure is withdrawn as best-case.

## Round-2 review — acceptance criteria

- **The overlap-CI win is NOT unconditional.** The WE PR is stacked on impl, so an impl `review:changes` bounce
  (which the guards above call the *norm*) moves the stacked base and **discards the WE half's first CI** — the
  same event that guts the FF-skip. So the "robust, always-true" framing overstates it: quantify B's benefit
  against the **observed impl-bounce rate** (from #2680), and treat the overlapped first CI as a win *conditional*
  on impl not bouncing, not a guarantee.
