---
kind: task
parent: "2275"
status: resolved
relatedTo: ["2267", "2337"]
dateOpened: "2026-07-08"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
graduatedTo: none
tags: [lane-pool, infra, footgun, verify]
---

# Verify the #2267 dirty-or-ahead guard actually protects an un-leased lane with only untracked work

Fresh evidence the #2267 data-loss guard may not fully hold. During this session I acquired a pooled lane
(`node we:scripts/lane-pool.mjs acquire`), scaffolded backlog item files into it (**untracked**, uncommitted),
and the files were then **hard-reset away** by concurrent drain activity (two batches, #206/#211, landed in the
same window). `lane-pool status --lane=2` afterwards showed **`leased: false`**. I recovered by re-doing the
work in an isolated `git clone --reference` under scratchpad and pushing fast.

## Why this is surprising

`#2267` resolved with a dirty-or-ahead skip in `laneDirtyOrAhead` (`we:scripts/lane-pool.mjs:335`), and that
check uses `git status --porcelain` **without** `--untracked-files=no` — so untracked files *should* count as
dirty (`uncommitted > 0`) and the lane *should* be skipped. It wasn't. Two candidate root causes:

1. **`acquire` didn't leave a live lease.** The #2275 lease path (`we:scripts/lane-pool.mjs:348-353`) skips a
   *leased* lane, but if `acquire` doesn't actually stamp/refresh a lease (or it had expired), the lane was
   unprotected and a concurrent recycle reset it.
2. **A `--force` reset bypassed the skip.** A concurrent `refresh`/`provision --force` (or an `acquire` of the
   same lane by the drain) overrides the dirty/ahead skip and resets regardless.

## What to do

- Reproduce: acquire a lane, drop an untracked file in it, run a concurrent `refresh` (and a `--force` one) from
  another checkout; confirm the un-forced refresh **skips** it and the forced one is the only thing that resets.
- Confirm `acquire` leaves a **live lease** that both `refresh`/`provision` and another session's `acquire`
  honor for the acquired TTL — if it doesn't, that's the fix (lease-on-acquire).
- Decide whether `--force`/a concurrent `acquire` should still be allowed to eat **untracked** work silently, or
  whether the porcelain skip should also gate the forced path for a leased/just-acquired lane.

## Acceptance

- A repro that shows whether an acquired lane with untracked work survives a concurrent (non-force) recycle.
- `acquire` demonstrably leaves a protecting lease (or a filed fix if it doesn't).
- If a real hole exists, either fix it here or split a fix item; if the guard already holds and this was
  operator misuse (no lease requested), document the correct hand-authoring invocation in the lane-pool header.

## Note

The *lesson* ("the only durable lane state is the pushed `lane/*` ref; hand-author in an isolated clone and push
fast") is already captured on-disk in #2267 — this task is specifically the **fresh evidence that the guard let
an un-leased untracked lane get reset**, owned by the lane-pool (#2275), not a re-statement of the lesson.

## Verification finding (2026-07-08)

Reproduced against the real `we:scripts/lane-pool.mjs` CLI (throwaway origin + reference + pool, no network) —
three new tests in `we:scripts/__tests__/lane-pool-refresh-guard.test.mjs`:

1. **The un-forced guard DOES protect untracked-only work.** A lane whose only change is an *untracked*
   (never-`git add`ed) file is `SKIPPED (dirty/ahead)` by a non-forced `refresh` and the file survives —
   `laneDirtyOrAhead`'s `git status --porcelain` (no `--untracked-files=no`) counts it as `uncommitted > 0`, as
   the item's own reading predicted. **Candidate root cause 1 as stated ("the porcelain skip missed untracked
   work") is disproven.**
2. **`acquire` leaves a live lease that `refresh` honors.** After `acquire`, a non-forced `refresh` is
   `SKIPPED` on the lease alone (before it even reaches the dirty/ahead check) and untracked work survives —
   lease-on-acquire works.
3. **`--force` is the data-loss path (characterized).** `refresh --force` overrides BOTH the lease skip AND the
   dirty/ahead skip and silently discards a leased lane's untracked work. This is the only path (besides a lease
   that expired past its TTL, `DEFAULT_LEASE_TTL_MINUTES=240`, or a lane acquired with no lease) that reproduces
   the 2026-07-07 loss. The observed `leased: false` afterward is consistent with an **expired/absent lease**,
   not the un-forced guard failing.

**Conclusion:** the #2267 guard holds for the un-forced path; no fix is owed *here*. The residual — should
`--force` (and a concurrent `--force` acquire) still be allowed to silently eat a **leased/just-acquired** lane's
untracked work, or should the porcelain skip also gate the forced path for a *live-leased* lane? — is a genuine
policy call, split to its own decision item (see relatedTo). Test 3 pins the current behaviour as that decision's
baseline.
