---
bornAs: xd3yhmz
kind: task
status: open
dateOpened: "2026-08-05"
tags: [drain, ci, gate, conveyor]
scope:
  - we:scripts/readiness/conveyor-state.mjs
  - we:scripts/readiness/__tests__/conveyor-state.test.mjs
  - we:scripts/fetch-parked.mjs
  - we:scripts/__tests__/fetch-parked.test.mjs
  - we:scripts/pr-state.mjs
  - we:scripts/__tests__/pr-state.test.mjs
  - we:scripts/merge-ai-prs.mjs
---

# Three rollup readers still take the first entry per check name, so the #1042 jam survives outside the drain

`#2932` fixed the drain's `isRequiredCheckGreen` / `isRequiredCheckFailed` to read the LAST rollup entry
per check name, but three sibling readers still call `.find(...)` and get the OLDEST run. So the jam that
held PRs #1042/#1046/#1012 is only half gone: the lander moved, the enqueue path and the fast-drain trigger
did not. Add the `check:standards` rule that would have caught the split, so the assumption cannot drift
across files again.

## Why it is owed

A head SHA routinely carries several runs of one check — a workflow `concurrency` group cancels the
in-flight run when a new push supersedes it, leaving a `CANCELLED` entry beside the `SUCCESS` that actually
finished. Reading the first entry picks the cancelled one. Each of these still does:

- **`we:scripts/conveyor/pr-watch.mjs:135`** — its own JSDoc says it *"Mirrors merge-ai-prs
  `isRequiredCheckGreen` … so the trigger and the lander read green identically."* After `#2932` that
  sentence is false. `isReadyToLand` never flips, so the fast-drain trigger does not fire and landing
  degrades to the resident daemon's sweep.
- **`we:scripts/lane-resume.mjs:439`** (`landDecision`) and **`we:scripts/lane-resume.mjs:556`**
  (`classifyLane`) — the enqueue side. `land <pr>` returns `red`/`not-green` and REFUSES to enqueue a PR
  whose latest run is green; `classifyLane` additionally re-buckets the lane's stack descendants as blocked.
  This is the original jam, one layer earlier.
- **`we:scripts/readiness/conveyor-state.mjs:163`** (`ciRollup`) — scans EVERY entry and returns `fail` on
  any `CANCELLED` one, so the conveyor reads a superseded-but-green PR as CI-failed for as long as the
  cancelled entry exists.

The same defect has a SECOND shape: readers that fold EVERY rollup entry into one verdict instead of selecting
one. "Take the first entry" and "fold all the entries" are the same bug — both let a superseded `CANCELLED`
outrank the `SUCCESS` that actually finished:

- **`we:scripts/fetch-parked.mjs:57`** (`rollupToCheckRows`) maps every rollup entry to a `{name, bucket}` row
  and hands the whole list to `classifyChecks` (**`we:scripts/pr-land.mjs:419`**), which is `some(isFail)` over
  all rows. One cancelled entry beside a later green one therefore reads red. Verified against unmodified `main`:
  `rollupToCheckRows([{__typename:'CheckRun',name:'test',conclusion:'CANCELLED'}, {…,conclusion:'SUCCESS'}])`
  → `[{name:'test',bucket:'cancel'},{name:'test',bucket:'pass'}]`, and `classifyChecks` of that →
  `{status:'failed', reason:'a required check failed'}`. Filtering to the required set does not help — both rows
  are named `test`.
- Two live readers inherit that fold: **`we:scripts/fetch-parked.mjs:189`** (`assembleParked`) — the `/review`
  bundle, which the review tooling itself consumes — and **`we:scripts/pr-state.mjs:55`** (`prStateRecord`) — the
  drain's `checks=` state line. Both report a genuinely green PR as `failed`.

NOT affected, and deliberately out of scope: **`we:scripts/pr-land.mjs:822`** and **`we:scripts/wait-green.mjs`**
also call `classifyChecks`, but they feed it `gh pr checks --required` output, which `gh` has already collapsed to
one row per check name. `classifyChecks` is correct for the row shape it was built for and must NOT be changed.
**`we:scripts/readiness/conveyor-instrument.mjs:474`** (`ciWindow`) scans every entry for the min `startedAt` /
max `completedAt`, which is the right thing to do with a full rollup — it derives no verdict and is not the
defect class.

Found by two independent review panels on PR #1049 (the hand-run `/review` panel and the
`we:scripts/workflows/review-parked-prs.mjs` convergence loop both surfaced it), and the fold-all shape by the
round-4 re-review of the same PR.

## Build

- ~~Import the shared `latestRequiredCheck` from `we:scripts/merge-ai-prs.mjs` in
  `we:scripts/conveyor/pr-watch.mjs` and `we:scripts/lane-resume.mjs` (both call sites) instead of
  re-deriving the lookup. Delete the local `.find(...)`.~~ **Delivered** by PR #1049 round 4 (the `#2932`
  lane): `we:scripts/conveyor/pr-watch.mjs` imports the helper, and both `we:scripts/lane-resume.mjs` sites go
  through one tested seam, `testConclusionOf`. The false parity claim in that docstring is corrected too.
- `ciRollup` needs a different shape — it distils ALL checks to one token rather than picking one check — so
  give it a per-name collapse (keep only the latest entry for each name) before the pass/fail/pending fold.
- `rollupToCheckRows` (`we:scripts/fetch-parked.mjs`) needs the SAME per-name collapse, for the same reason and
  ahead of the same fold: collapse the rollup to the latest entry per check name FIRST, then map to `{name,
  bucket}` rows. Fixing that one seam repairs BOTH open readers — `we:scripts/fetch-parked.mjs:189` and
  `we:scripts/pr-state.mjs:55` both route through it. Do NOT "fix" this inside `classifyChecks`
  (`we:scripts/pr-land.mjs`): its other callers are fed `gh`-collapsed rows that carry no `__typename` or
  ordering to collapse on, so rollup semantics do not belong there.
- Both collapses want ONE named seam so the two items and the drain cite the same rule rather than three
  hand-rolled copies. Proposed: **`collapseRollupToLatestPerName`**, exported from `we:scripts/merge-ai-prs.mjs`
  beside `latestRequiredCheck`, with `latestRequiredCheck` reduced to a by-name lookup over its output. The rule
  is exactly the one `latestRequiredCheck` already implements, generalised from one name to every name: within a
  name, take the FIRST non-empty `rollupRowKind` tier (`CheckRun` → untagged → `StatusContext`) and then the LAST
  entry in that tier. Latest-wins stays principled, not "ignore CANCELLED" — if the newest run is cancelled the
  check genuinely has no current verdict.
- **Not implemented by PR #1049**, which is prose-only from round 4 onward; this item owns building all of it.
- The `check:standards` rule over `statusCheckRollup` consumers is carved out to
  [#2931](2931-gate-any-statuscheckrollup-consumer-that-selects-a-check-out.md) — the PREVENTION outlives
  the specific readers it was written for, so it is tracked on its own rather than inside this repair.

## Acceptance

- A rollup with a superseded `CANCELLED` entry beside a later `SUCCESS` reads green in
  `we:scripts/conveyor/pr-watch.mjs`, `we:scripts/lane-resume.mjs` (both sites),
  `we:scripts/readiness/conveyor-state.mjs`, `we:scripts/fetch-parked.mjs` (the `/review` bundle's
  `checks.status`) and `we:scripts/pr-state.mjs` (the `checks=` token), matching the drain.
- `we:scripts/pr-land.mjs:822` and `we:scripts/wait-green.mjs` are UNCHANGED and still green — the repair must
  not alter `classifyChecks` itself.
- The CheckRun-over-StatusContext preference from PR #1049 rides along wherever the shared helper is adopted,
  so a posted `test` commit status cannot clear any of these paths either.
- The new gate fires on a re-introduced `.find(...)` over `statusCheckRollup` and is green on the repaired
  tree.
