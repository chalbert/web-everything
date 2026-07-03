---
kind: story
size: 5
parent: "2193"
status: resolved
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [lane, pr-flow, merge-queue, session-tooling, drain]
---

# Lane validates the full PR check suite before push, and labels ready-to-merge only after all required checks are green

Today a lane gates only on a **local, file-scoped fast-fail** (`check:standards --local --files`) and then
opens the PR with `we:scripts/pr-land.mjs --no-wait` and labels it `ready-to-merge` **immediately**, before any
CI has run (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:389`). So the label means
*"passed a local lint on the touched files"*, not *"every check this PR runs is green"*. Observed live
2026-07-03: PRs #55/#57/#59/#67 carried the label while their required `test` check was red. The only real gate
is the drain (it refuses to merge a red `test`) — a backstop doing the lane's job.

**Ruled 2026-07-03 — the lane owns delivering a correct PR, validated as early as possible:**

1. **Run every check the PR runs, before pushing** — not the file-scoped subset. The lane runs the full
   locally-runnable suite (the same `test`/`check:standards`/visual/a11y CI runs) **in its clone before it
   pushes**. A red result is fixed in the lane *then and there* (cheapest — full context in hand); it never
   pushes known-broken work. The push should represent already-validated work.
2. **Label `ready-to-merge` only after all required checks are green** — for checks that can only run
   server-side (e.g. `test` on CI, and any non-required signal the drain still respects), open the PR, **wait
   for the required checks**, and apply the label only once they pass (drop `--no-wait` for the label step, or
   add a post-CI labelling step). If CI still fails, the lane fixes it — not the drain, not a human.

**Trade-off (accepted):** the lane runs the full suite (heavier than the file-scoped fast-fail) and blocks
~3 min on CI before labelling, versus today's fire-and-forget open. Worth it — `ready-to-merge` becomes a true
"fully-checked, drain may land" signal, red PRs never enter the queue, and the drain's green-gate becomes a
backstop rather than the primary filter. (Rejected: a reconciler that strips the label from red PRs — cheaper
but leaves the lane's broken work for someone else, against lane-owns-correctness.) Relates to #2196 (wired the
label onto every producer path).
