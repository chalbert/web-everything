---
bornAs: xw0odtv
kind: story
size: 3
status: open
dateOpened: "2026-09-04"
tags: [drain, conveyor, review, merge, conflict, alerting]
scope:
  - we:scripts/conveyor/parked-pr-conflict-watch.mjs
  - we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs
  - we:skills-src/conveyor/runner.mjs
---

# Parked PRs (review:human/pending/changes) get no mechanical alert when they drift into a real merge conflict

## The finding

**Symptom.** WE PR #1920 (`WE #2412: engine-tier auto-land requires redteam:accepted + a universal
merge-time trace`) opened at 2026-09-04T22:56Z carrying `review:human` (a gate-self/statute edit —
the conflict-of-interest label). By 23:26Z GitHub reported `mergeable: CONFLICTING` /
`mergeStateStatus: DIRTY`. The operator only discovered this by chance, about to clear the
`review:human` gate.

**Reconstructed root cause — confirmed a real overlapping-edit conflict, not a bad rebase or a
force-push.** `git merge-base origin/main lane/2412c-engine-tier-redteam-gate` = `0c779a1cf`
(2026-09-04 17:09:20 -0400). Sixteen merge commits landed to `main` after that point, including
`#1911` ("WE #2412: merge-time SHA+session traceability…", merged 20:48:38 -0400) — which touches
`we:scripts/merge-ai-prs.mjs`, the SAME file PR #1920 also edits. `git diff --name-only
0c779a1cf..origin/main -- we:scripts/merge-ai-prs.mjs` confirms the overlap. Both PRs are genuinely
independent #2412 sub-slices that happened to touch the same function region — a real conflict, no
tooling malfunction.

**Root cause — no mechanical pass watches an already-parked PR's live `mergeable` state.**
Traced every existing sweep that reads `mergeable`/`mergeStateStatus`:

- `we:scripts/merge-ai-prs.mjs`'s `classifyPr` DOES read `mergeable` (`mergeable !== 'MERGEABLE' →
  decision:'skip'`), and a review-held PR IS still a candidate in its bare (unlabelled/AI-generated)
  listing. But a `skip` verdict for a non-rebase-drop-eligible PR just `continue`s — no comment, no
  label, no signal escapes the process. It's read, computed, and discarded every sweep.
- `we:scripts/conveyor/pr-watch.mjs` (`EXIT_PARKED`) is a ONE-SHOT poll bound to one
  actively-dispatched PR: the instant it first observes a park label it exits (to wake the
  interactive/mechanical session that dispatched it). Nothing resumes watching that PR afterward —
  it is explicitly a wake signal, not a standing watch.
- `we:scripts/conveyor/branch-drift.mjs` (#3464) watches exactly ONE named long-lived branch
  (`lane/mechanical-dispatcher` vs `main`) for drift/conflict, not the population of open,
  review-parked PRs.
- `we:scripts/conveyor/review-status-tag.mjs` / `we:scripts/conveyor/review-round-tag.mjs` are
  per-PR, invoked only AT review/fix-dispatch time (from the review-dispatch agent brief) — not a
  periodic sweep over PRs no session is currently touching.
- **#2824** (`we:backlog/2824-launch-agnostic-freshness-gate-any-open-pr-behind-main.md`,
  `status: open`, not yet built) is the closest prior art and the one card that already reasoned
  carefully about this exact axis — but it is deliberately scoped to `mergeStateStatus === 'BEHIND'`
  ONLY (a cleanly rebasable staleness), explicitly EXCLUDING `CONFLICTING`/`DIRTY`: its own
  `isFreshnessRefreshTarget` spec states "DIRTY/CONFLICTING (not BEHIND) + review:human → false … a
  real-conflict case, not a pure-staleness one, and stays left to `/finish`", and its
  rebase-drop-skip fork says a real conflict is "left as a skip, logged, no escalation." So even
  once #2824 ships, a genuinely CONFLICTING parked PR stays silent — #2824 does not close this gap,
  it deliberately routes around it.

**Confirmed: this is a genuinely unwatched axis, not a duplicate of a filed card.** Searched
`backlog/` for "stale"+"review:human" and "conflict"+"parked" — the only close hits are #2824
(BEHIND only, above) and #3464/branch-drift (one named branch, not PRs). Neither covers "an open,
review-parked PR's own `mergeable` going CONFLICTING."

## Decided design

**A new, small, standing pass — `we:scripts/conveyor/parked-pr-conflict-watch.mjs`** — mirrors
`we:scripts/conveyor/branch-drift.mjs`'s own shape (pure classify/plan core + a thin `gh`-only IO
shell) and `we:scripts/conveyor/review-status-tag.mjs`'s own "informative, idempotent, auto-managed
label" contract, wired into `we:skills-src/conveyor/runner.mjs`'s `makeCliMechanicalPasses` exactly
like the `we:scripts/conveyor/branch-drift.mjs` `sweep` line is (one more `runQuiet(...)` line) — so
it rides the SAME tick the headless runner already runs, no new cron/daemon.

**Detection.** `isParkedConflictTarget(pr)`: `pr.mergeable === 'CONFLICTING'` AND
`hasUnclearedReviewLabel(pr.labels, {allowPending:false})` — reusing the SAME canonical hold
predicate `classifyPr`/`#2824`'s own `isFreshnessRefreshTarget` use, not a re-declared local check.
`allowPending: false` so a plain `review:pending` park (not just `review:human`) is covered too, per
the task's own framing ("review:human/review:pending waiting for a slow human/review step").

**Alert shape — a label + a one-time comment, not an auto-rebase.** On first detection: `ensureLabel`
+ apply an informative `merge-status:conflicting` label (auto-managed, mirrors
`review-status:<state>`'s own color/description/idempotency contract in
`we:scripts/lib/review-label-provider.mjs`), and post ONE comment explaining the drift. The label's
own presence/absence IS the idempotency marker — no comment is re-posted on a later tick while the
label is already applied; when the conflict clears (PR rebased/resolved), the label is removed on the
next sweep, self-healing, no comment needed for that direction.

**Why alert-only, not auto-rebase (the judgment call the brief asked me to make and justify).**
A REAL content conflict (as opposed to #2824's clean-rebase BEHIND case) has no single mechanically
correct resolution — resolving it means choosing which side's edit wins in the overlapping region,
which is exactly the judgment #2824's own decided design already refuses to automate ("left as a
skip, logged, no escalation to an agent… genuinely broken-diff conflict repair is judgment work
already scoped to a human via `/finish`"). Doing so on a PR that is furthermore explicitly parked for
review (nobody has signed off on its content yet) compounds the risk: rewriting it out from under an
in-flight human review is the same footgun `#3350`'s own invariant names for the CI-restart case, one
level up — here it would restart the human's own review context, not just CI. This pass's job is the
one mechanically-safe half: make the drift IMPOSSIBLE to miss, mechanically, every tick — not resolve
it.

## Tasks

1. `we:scripts/conveyor/parked-pr-conflict-watch.mjs` — pure core (`isParkedConflictTarget`,
   `planConflictLabelChange`) + IO shell (`defaultListParkedPrs` via `gh pr list --state open --json
   number,labels,mergeable,mergeStateStatus,headRefName[, --repo=<repo>]`, `watchParkedPrConflicts`
   using `we:scripts/lib/review-label-provider.mjs`'s `createGhProvider`), CLI `sweep` verb (mirrors
   `we:scripts/conveyor/branch-drift.mjs`'s `IS_CLI` shape), `--dry-run` (log only, no `gh`
   mutation) and `--repo=` flags.
2. Unit tests: pure-core branches (CONFLICTING+human→true, CONFLICTING+pending→true,
   CONFLICTING+changes(no accepted)→true, CONFLICTING+accepted-only→false, CONFLICTING+no
   label→false, MERGEABLE/UNKNOWN+human→false); label-plan branches
   (not-yet-labelled+conflicting→add, already-labelled+still-conflicting→no-op,
   labelled+resolved→remove); IO-shell argv assertions with `exec`/`provider` mocked (no real `gh`
   call in tests).
3. Wire `we:scripts/conveyor/parked-pr-conflict-watch.mjs` into
   `we:skills-src/conveyor/runner.mjs`'s `makeCliMechanicalPasses` (a `runQuiet(...)` call passing
   its `sweep` verb), beside the `we:scripts/conveyor/branch-drift.mjs` line.
4. Live-verify against the real, already-conflicting PR #1920 (`--dry-run` first, then for real) —
   this doubles as the regression fixture AND remediates the live incident that motivated this item.
5. `npm run check:standards` (0 errors) and the full `vitest` suite, clean.

## Done when

1. `isParkedConflictTarget(pr)` is true iff `mergeable === 'CONFLICTING'` AND the PR carries an
   uncleared `review:human`/`review:pending`/`review:changes` hold; false for a `review:accepted`-only
   PR and for any non-CONFLICTING `mergeable` value. All branches unit-tested.
2. Running the new pass's `sweep` verb against the live repo applies a `merge-status:conflicting`
   label + posts one comment on PR #1920 (or whichever real conflicting parked PR exists at run
   time), and a second run is a no-op (idempotent — no duplicate comment, no duplicate label-edit
   call).
3. The pass is wired into `makeCliMechanicalPasses` so it runs on the standing headless-runner tick,
   with no separate cron/daemon.
4. `npm run check:standards` is 0 errors; the full `vitest` suite is green.
