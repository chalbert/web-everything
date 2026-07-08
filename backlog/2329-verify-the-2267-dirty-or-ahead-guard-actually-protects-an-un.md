---
kind: task
parent: "2275"
status: open
relatedTo: ["2267"]
dateOpened: "2026-07-08"
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
