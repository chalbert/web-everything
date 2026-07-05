---
kind: story
size: 3
relatedTo: ["2231", "2219", "2198", "2197", "2123"]
status: open
dateOpened: "2026-07-03"
tags: [lane, pr-flow, merge-queue, drain, backlog, self-heal]
---

# `/merge` and `pr-land` should self-heal duplicate-backlog-ID collisions like the drain does

> **Reframed under epic #2289 (2026-07-05).** Direction shifted from reactive healing to structural prevention. The self-heal is no longer the primary fix — it becomes a dormant **backstop** (#2291). #151, which implements this item, should still land as the interim/backup layer; the `/pr` + `/merge` route wiring it adds gets pruned once the drain is the sole writer (#2290) and numbers are assigned just-in-time (#2288).

When two parallel lane sessions allocate the **same backlog `NNN`** (the ID-storm — `we:scripts/backlog.mjs` scaffold re-globs to dodge it, but hand-authored files and long-lived branches still collide), a PR that adds `we:backlog/NNN-a.md` goes green in isolation but turns the required `test` **red** the moment it rebases onto a `main` that already carries `we:backlog/NNN-b.md`: two files share a num, so `loadBacklog()` and `buildGraph()` resolve the collision to different items and disagree on `tier`, failing `we:src/_data/__tests__/backlogGraph.test.ts` ("carries the #254 leverage fields"). Today `/merge` (`we:scripts/merge-ai-prs.mjs`) only **skips and reports** such a PR — the human has to renumber it by hand. Observed live 2026-07-03: PR #89 (a drain finding filed as `#2219`) collided with the prepare/claim/release decision already on main under `#2219`; it had to be renumbered manually (2219 → 2225 → 2223, chasing a moving ID space) before a peer session re-filed the same finding under a fresh ID (`#2231`) and #89 was closed as a dupe.

**Fix:** give `we:scripts/merge-ai-prs.mjs` (and `we:scripts/pr-land.mjs`, and the `/drain` rebase-drop) a shared **ID-collision self-heal**: before the required check, detect that the PR's added `backlog/NNN` file collides with a different `NNN` on the merge base, renumber the PR's file to a **free gap ID** (below the `max+1` allocation frontier, so a concurrent scaffold can't re-collide), rewrite intra-repo `#NNN` and `blockedBy` references, commit the rename onto the lane branch, and re-run. Cover it with a unit test (collision on base ⇒ renumber-to-gap, no collision ⇒ untouched). This is the merge-time analogue of the drain's auto-rebase-drop (#2198) — the transport heals the storm instead of leaving it for a human.
