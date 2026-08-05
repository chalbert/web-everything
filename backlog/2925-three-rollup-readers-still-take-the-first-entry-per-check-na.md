---
bornAs: xd3yhmz
kind: task
status: open
dateOpened: "2026-08-05"
tags: [drain, ci, gate, conveyor]
scope:
  - we:scripts/conveyor/pr-watch.mjs
  - we:scripts/lane-resume.mjs
  - we:scripts/readiness/conveyor-state.mjs
  - we:scripts/check-standards-rules.mjs
---

# Three rollup readers still take the first entry per check name, so the #1042 jam survives outside the drain

`#xkfv491` fixed the drain's `isRequiredCheckGreen` / `isRequiredCheckFailed` to read the LAST rollup entry
per check name, but three sibling readers still call `.find(...)` and get the OLDEST run. So the jam that
held PRs #1042/#1046/#1012 is only half gone: the lander moved, the enqueue path and the fast-drain trigger
did not. Add the `check:standards` rule that would have caught the split, so the assumption cannot drift
across files again.

## Why it is owed

A head SHA routinely carries several runs of one check — a workflow `concurrency` group cancels the
in-flight run when a new push supersedes it, leaving a `CANCELLED` entry beside the `SUCCESS` that actually
finished. Reading the first entry picks the cancelled one. Each of these still does:

- **`we:scripts/conveyor/pr-watch.mjs:135`** — its own JSDoc says it *"Mirrors merge-ai-prs
  `isRequiredCheckGreen` … so the trigger and the lander read green identically."* After `#xkfv491` that
  sentence is false. `isReadyToLand` never flips, so the fast-drain trigger does not fire and landing
  degrades to the resident daemon's sweep.
- **`we:scripts/lane-resume.mjs:439`** (`landDecision`) and **`we:scripts/lane-resume.mjs:556`**
  (`classifyLane`) — the enqueue side. `land <pr>` returns `red`/`not-green` and REFUSES to enqueue a PR
  whose latest run is green; `classifyLane` additionally re-buckets the lane's stack descendants as blocked.
  This is the original jam, one layer earlier.
- **`we:scripts/readiness/conveyor-state.mjs:163`** (`ciRollup`) — scans EVERY entry and returns `fail` on
  any `CANCELLED` one, so the conveyor reads a superseded-but-green PR as CI-failed for as long as the
  cancelled entry exists.

Found by two independent review panels on PR #1049 (the hand-run `/review` panel and the
`we:scripts/workflows/review-parked-prs.mjs` convergence loop both surfaced it).

## Build

- Import the shared `latestRequiredCheck` from `we:scripts/merge-ai-prs.mjs` in
  `we:scripts/conveyor/pr-watch.mjs` and `we:scripts/lane-resume.mjs` (both call sites) instead of
  re-deriving the lookup. Delete the local `.find(...)`.
- `ciRollup` needs a different shape — it distils ALL checks to one token rather than picking one check — so
  give it a per-name collapse (keep only the last entry for each name) before the pass/fail/pending fold.
- Add a `check:standards` rule: error on any `statusCheckRollup` consumer under `we:scripts/` that selects a
  check by name outside the shared helper (`statusCheckRollup` combined with `.find(` or a name-match loop),
  allowlisting `latestRequiredCheck` itself. `statusCheckRollup` appears nowhere in
  `we:scripts/check-standards-rules.mjs` today.

## Acceptance

- A rollup with a superseded `CANCELLED` entry beside a later `SUCCESS` reads green in
  `we:scripts/conveyor/pr-watch.mjs`, `we:scripts/lane-resume.mjs` (both sites) and
  `we:scripts/readiness/conveyor-state.mjs`, matching the drain.
- The CheckRun-over-StatusContext preference from PR #1049 rides along wherever the shared helper is adopted,
  so a posted `test` commit status cannot clear any of these paths either.
- The new gate fires on a re-introduced `.find(...)` over `statusCheckRollup` and is green on the repaired
  tree.
