---
kind: story
size: 3
relatedTo: ["2199", "2200", "2213"]
status: open
dateOpened: "2026-07-03"
tags: [lane, pr-flow, drain, ci]
---

# Lane closure is not strictly gated on green — a `check-timeout` leaves a pending, unlabelled PR

Under #2199 the `ready-to-merge` label means "required checks are green", and `we:scripts/pr-land.mjs`
`--label-on-green` waits for CI before labelling. On the happy path it waits for green, then labels. But if CI
**outlasts** the `--timeout-min` wait, pr-land returns `check-timeout` → the PR is left **open but unlabelled**,
and the lane still **closes** (status `pr-open`, carried-for-labelling). So the green guarantee lives entirely
in the *label*, not in lane-closure: on a timeout the lane can wrap with the PR still pending, and it's up to a
later pass (or the drain, which re-checks green before merging) to finish it.

This is a **liveness** gap, not a safety one — nothing red merges (the label + the drain's own green re-check
are a double gate). The risk is a timed-out PR being silently left pending-unlabelled and forgotten.

**Fix (pick/compose):**
- **Post-CI labeller / reconciler:** a lightweight pass (or a `pr-land --label-on-green` background retry) that
  labels a PR the moment its required checks go green, so a timeout doesn't strand it — the label eventually
  applies with no human step.
- **Definite lane outcome:** on `check-timeout`, close the lane as `carried` (explicitly "CI not yet green —
  finish me"), not `pr-open`, so it reads as unfinished and `/resume` (#2200) reliably picks it up.
Relates to #2199 (label-when-green), #2213 (the drain's label-propagation re-poll), #2200 (/resume).
