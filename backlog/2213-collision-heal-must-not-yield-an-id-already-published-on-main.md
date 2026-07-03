---
kind: task
status: open
dateOpened: "2026-07-03"
relatedTo: ["2181", "2071", "2202", "2200"]
tags: [pr-flow, land, self-heal, backlog-ids, merge-queue, resume, footgun]
---

# Collision heal must not yield an id already published on main (resume-land direction bug)

The #2181 per-land id-collision heal runs `we:scripts/backlog-renumber-collisions.mjs` with **no
`--base-ref`**, so on post-merge main it yields the **highest git-ordinal** file. That is correct for a
same-batch parallel land (neither colliding file is on main yet), but **wrong for a resume land** where a
lagging `lane/*` was authored FIRST and lands LAST: the already-published main item then has the higher
ordinal and gets yielded — renumbering an item that is live on `main` and cited elsewhere, which is worse
than failing.

Hit for real resolving PR #35 (`lane/2191-branding-prep`): the lane authored #2191–#2193 at 09:03, the
epic-2193 closeout landed those ids on main at 10:03, and the heuristic wanted to renumber the **landed**
items. Worked around by hand (fed corrected ordinals so the incoming lane's new files yield instead).

**Fix.** When healing a land, treat the ids present on **pre-merge main** (the branch being landed onto)
as an immutable base so a published id is never yielded — e.g. pass `--base-ref=<pre-merge-main sha>` in
`we:scripts/pr-land.mjs` `runHeal()` (and the `lane-resume land` path that reuses it). The incoming lane's
newly-created file is the only legitimate yielder. Add a regression fixture: lane file older than the
colliding main file ⇒ the **lane** file yields, never the main one.
