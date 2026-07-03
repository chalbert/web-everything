---
name: lane-refresh-wipes-unmapped-lanes
description: idle unmapped lane clones get hard-reset to origin/main mid-work — map/own a lane before editing
metadata:
  type: feedback
---

An **idle, clean, unmapped** lane clone under `~/workspace/.lanes/web-everything/lane-N` can be
**hard-reset to the latest `origin/main`** by the pool refresher *while you are working in it* — it
silently wiped an in-progress `claim` + a batch of `Edit`s (2026-07-03, #2112 ratification) because
the lane read as "clean" and was refreshed to a newer main (a peer PR had landed).

**Why:** the lane pool keeps idle lanes current; "clean + unmapped" reads as "free to refresh." An
uncommitted working tree in such a lane is not protected.

**How to apply:** before editing in a lane, **own it** — `node scripts/lane-pool.mjs map --lane=N
--item=NNN` (refresher skips mapped/dirty lanes). Prefer a lane already at the latest `origin/main`
(check `lane-pool status --json`: `head` == origin/main, `behind: 0`). Work fast, commit early, and
after landing via `pr-land` reset the lane (`git reset --hard origin/main`) + `lane-pool unmap
--lane=N` so the pool stays reusable. Related: [[single-session-should-use-a-lane]] (#2123 — every
edit session runs in a lane clone), [[pr-land-dogfood-mechanics]] (the lane->main transport).
