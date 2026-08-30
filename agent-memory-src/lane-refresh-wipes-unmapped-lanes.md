---
name: lane-refresh-wipes-unmapped-lanes
description: an unleased/unmapped lane clone can get hard-reset to origin/main — silently discarding committed-but-unpushed work too — either via the background refresher (idle+dirty) or a plain `acquire --lane=N` re-grab; map/own a lane before editing, and check reflog before assuming work is lost
metadata:
  type: feedback
---

An **idle, clean, unmapped** lane clone under `~/workspace/.lanes/web-everything/lane-N` can be
**hard-reset to the latest `origin/main`**, discarding work in it, in (at least) two distinct ways:

1. **The background pool refresher**, while you are working in it — it silently wiped an in-progress
   `claim` + a batch of `Edit`s (2026-07-03, #2112 ratification) because the lane read as "clean" and
   was refreshed to a newer main (a peer PR had landed). This hits an *uncommitted* working tree.
2. **A plain `node scripts/lane-pool.mjs acquire --lane=N --adopt` re-grab of a lane you just
   `release`d** — confirmed 2026-08-29. `release` drops the lease; the next `acquire --lane=N` on that
   now-unleased lane resets it to `origin/main` immediately, with no separate "refresh" step. This hits
   a lane that is git-`clean` but **committed and ahead of `origin/main`** — the guard added in #3390
   ("acquire --lane=N now refuses to reclaim a dirty/ahead lane without --force") did not catch this
   case in practice; a clean-but-ahead lane still got silently reset. Concretely: filed a backlog item,
   committed it, released the lane to clear a stale `verify-lane` marker (`reset` refuses while a lease
   is live), then `acquire --lane=N --adopt`'d it back — the commit was gone, replaced by latest main.

**Why:** the lane pool treats "no live lease" as "free to reset to main," regardless of whether the
lane carries committed work — it only special-cases *dirty* (uncommitted), not *ahead* (committed).

**How to apply:**
- Before editing in a lane, **own it** — `node scripts/lane-pool.mjs map --lane=N --item=NNN` (skips
  mapped/dirty lanes) — and don't `release` a lane between committing and landing its PR if you can
  avoid it; re-acquiring it can reset it out from under you.
- If you must release a lane holding a committed-but-unlanded commit (e.g. to clear a stale
  `verify-lane` marker that refuses to reset under a live lease), **note the commit SHA first**. If a
  later `acquire` on that lane comes back clean at `origin/main` with your commit missing, it is not
  lost: check `git reflog` in that lane clone for a `Reset to origin/main` entry just after your commit,
  then `git cherry-pick <sha>` it back onto the new HEAD before re-running verification.
- Prefer a lane already at the latest `origin/main` (check `lane-pool status --json`: `head` ==
  origin/main, `behind: 0`). Work fast, commit early, and after landing via `pr-land`/the `open-pr`
  operation, reset the lane (`git reset --hard origin/main`) + `lane-pool unmap --lane=N` so the pool
  stays reusable.

Related: [[single-session-should-use-a-lane]] (#2123 — every edit session runs in a lane clone),
[[pr-land-dogfood-mechanics]] (the lane->main transport).
