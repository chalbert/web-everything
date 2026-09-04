---
bornAs: xra0mqn
kind: task
tier: pinned
parent: "3383"
status: resolved
relatedTo: ["3449", "3457", "3443", "3463"]
dateOpened: "2026-09-03"
dateStarted: "2026-09-04"
dateResolved: "2026-09-04"
tags: [conveyor, lane-pool, scope, reconciliation, mechanical-dispatcher]
scope:
  - we:scripts/conveyor/
  - we:skills-src/conveyor/
  - we:scripts/readiness/dispatch-plan.mjs
---

# A long-lived diverged prototype branch has no reconciliation cadence against main's independently in-scope dispatched changes

`origin/lane/mechanical-dispatcher` sat 78 commits behind / 29 ahead of `origin/main` (live numbers,
2026-09-03), with an hours-long-failing auto-sync cron unable to merge `main` in, hitting genuine content
conflicts in `we:scripts/operations/__tests__/dispatch-lane.test.mjs`, `we:scripts/operations/dispatch-lane-io.mjs`,
`we:scripts/operations/dispatch-lane.mjs`, and `we:skills-src/conveyor/runner.mjs`. This was investigated for
"did something escape its declared `scope:` or was a scope-conflict guard bypassed" — it did not, and none
was. **Every commit on both sides checked below stayed inside its own item's own declared `scope:`.** The
real gap is structural: this repo's scope/lease machinery was built to hold *items dispatched into the same
lane pool* apart, and it has no reach at all into a long-lived branch checked out entirely outside that pool.

## The scope/lease machinery, traced end to end — it never reaches a standalone branch checkout

- **`we:scripts/readiness/file-locks.mjs`'s write-time lock is explicitly LOCAL to one checkout.** Its own
  docblock (Fork 1a, #1936): `LOCK_ROOT = '.claude/locks'` sits "under the LOCAL central checkout... never
  committed/pushed." A lock directory that is gitignored and per-clone by design cannot, even in principle,
  arbitrate between two separately-cloned checkouts — it only ever sees processes sharing the same working
  copy.
- **`we:scripts/lane-pool.mjs`'s `--scope=<repo:path,...>` is advisory-only, and only among lanes in the
  SAME pool.** Its own CLI docblock (#2560): "declares this lane's ADVISORY predicted file-scope —
  persisted into the marker (the live scope-lease collector reads it) + warns on overlap, but **NEVER gates
  the acquire** (the whole-clone lease is the real lock)." The pool itself (docblock lines 13-16) is a fixed
  set of clones under `~/workspace/.lanes/<repo>/lane-<n>`, each "fetch + hard-reset to `origin/main` between
  batches" — i.e. the whole mechanism is defined in terms of lanes that continuously track one integration
  branch. `origin/lane/mechanical-dispatcher`, and every scratch clone built to exercise it
  (`~/workspace/wev-scratch-dispatcher-2` through `-4`, all ad hoc, per `#3383`'s own session history), are
  not members of that pool — `node we:scripts/lane-pool.mjs list --json` never lists them, `acquire`/`release`
  never touch them, and the reap-on-acquire backstop (`reapDeadLeasesInPool`, #2748) never runs against
  them.
- **`we:scripts/readiness/dispatch-plan.mjs`'s `scope:`-driven collision avoidance (the mechanism
  `we:docs/agent/backlog-workflow.md` describes: "the conveyor dispatcher reads it to hold overlapping items
  apart") is scoped to items competing for the SAME dispatch cycle against the SAME lane pool.** It has no
  model of "a second, independently-checked-out branch is also live-editing this file" — that branch is not
  a queued item, not a lane, not part of any read `we:scripts/readiness/dispatch-plan.mjs` performs.

In short: the scope/lease-conflict machinery this repo already built (`#3457`'s own grounding cites exactly
these three mechanisms) is real and does what it says — but it structurally arbitrates *within one pool of
lanes tracking one branch*, never *across* a long-lived, separately-checked-out branch and that branch's own
target. This was never a bypass or a broken guard; it is outside every guard's design perimeter.

## Not a scope violation — checked commit by commit, not assumed

`git merge-base origin/main origin/lane/mechanical-dispatcher` = `f97716c2`. Since that point:

**`main`-side commits touching the four conflicting files:**
- `697392f72` / PR merge `1c009112` — **`#3332`**, `scope: ["we:scripts/operations/dispatch-lane-io.mjs",
  "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs"]` —
  exactly the three `scripts/operations` files it touched. No violation.
- `f26a950b9` / PR merge `4a4033be4` — **`#3421`**, `scope: [we:scripts/conveyor/, we:skills-src/conveyor/,
  we:skills-src/capture-learning/, we:skills-src/harvest-learnings/]` — a directory-level scope that covers
  `we:skills-src/conveyor/runner.mjs`, the file it touched there. No violation (dir-level scope is a
  `check:standards` *warning*, never an error, per `we:docs/agent/backlog-workflow.md`'s own scope rules).

**`origin/lane/mechanical-dispatcher`-side commits touching the same four files since the same merge-base**
(non-exhaustive — the branch's own commit list is long; these are the ones whose card frontmatter was
cross-checked): `a74aece47` (**`#3416`**, `scope: [we:skills-src/conveyor/]`), `cc909b9f5` (**`#3404`**,
`scope` names `we:skills-src/conveyor/runner.mjs` explicitly), `df4bbd0a2` (**`#3406`**, `scope` names
`we:skills-src/conveyor/runner.mjs` explicitly), and `09ce669b9` (**`#3398`**, `scope: [we:skills-src/conveyor/]`).
Every one of these cards' own current frontmatter (read from this checkout's `backlog/*.md`, i.e. the board
`main` shows) declares exactly the directory/file its branch-side commit actually touched — **`#3416`,
`#3404`, and `#3406` already read `status: resolved`, `dateResolved: 2026-09-02` on the board even though
their code has not yet landed on `main` at all** (confirmed: none of their commits appear in the `main`-side
list above) — a live instance of the same card-status-vs-real-state lag `#3457` already names, just for
*graduation* status rather than *dispatch-worthiness*.

**Conclusion: zero scope violations found on either side.** Two genuinely independent, individually
correctly-scoped dispatch streams — one landing on `main` via the normal pipeline, one landing on the
long-lived branch directly per `#3383`'s own "fix it on the prototype directly" doctrine — both correctly
touched the same hot files, because nothing ever reconciled the branch's drift against `main`'s parallel,
equally-in-scope stream while it accumulated for days.

## This is a live, current, and worsening gap — not a one-off

- **Reconciliation has only ever happened by a human/session noticing drift and rebasing by hand.**
  `#3383`'s own session history: 87 commits behind → manually rebased (2026-08-30/31) → drifted to 18 behind
  again within the same day → manually rebased again (2026-08-31) → **78 behind again as of this item's own
  filing (2026-09-03)**. No mechanized cadence has ever run this; every reconciliation was a session
  deciding, on its own initiative, to do it.
- **The live auto-sync cron (`wev-scratch-dispatcher-4`, pid 24624, `while true; do sleep 180; git fetch
  origin main:refs/remotes/origin/main-fresh; git merge origin/main-fresh --no-edit --quiet; ...; done`)
  has pushed nothing back to `origin/lane/mechanical-dispatcher` — `git log origin/lane/mechanical-dispatcher`
  shows zero `Merge remote-tracking branch 'origin/main-fresh'` commits, even though the LOCAL checkout is 69
  commits ahead of `origin/lane/mechanical-dispatcher` with many such merges.** Whatever partial reconciliation
  this cron achieves before hitting a conflict lives only in one scratch clone's local history; it is silently
  lost (or at best manually re-discovered) the next time a *different* scratch clone is cut from the branch.

## Related but distinct

- **`#3449`** (lane-pool lease reconciliation must not depend on an actively-ticking `/conveyor` session) is
  the closest sibling in shape — same root cause ("every reconciliation path is gated on a live session or a
  fresh `acquire`") applied to a *different* resource: lane-pool `.lane-lease` markers, not a whole branch's
  divergence from `main`. Its own "Done when" pattern (name at least one cadence independent of a live
  session) is the direct precedent for this item's own Done-when below.
- **`#3457`** (dispatch must cross-check an open item's status against real merged-PR history) is the same
  family again — "trust live ground truth, not stale bookkeeping" — for item *status*, not branch drift.
- **`#3443`** (graduate `origin/lane/mechanical-dispatcher` to `main` in small pieces) is the eventual
  structural fix — retiring the long-lived branch removes this gap's precondition entirely. This item is
  filed independently because `#3443` names *what* to graduate, not *how the branch avoids drifting into
  unresolvable conflict while graduation is still in progress* — the two are complementary, not duplicates,
  and this item should not block on `#3443` completing.
- **`3463`** (sibling card, filed alongside this one) covers the separate question of what happens
  *when* an unresolvable conflict is hit — notification/escalation. This item is about there being no
  cadence that would let most conflicts be *caught and reconciled before* they became unresolvable in the
  first place.

## Done when

1. **A reconciliation cadence exists for a long-lived dispatched-work branch that does not depend on a
   human or an interactive session noticing drift** (mirroring `#3449`'s own Done-when shape) — e.g. a
   scheduled dry-run merge/rebase-check that reports live conflict state to a durable, checkable place, or a
   hard age/commit-count ceiling past which further dispatch onto the branch is held until reconciliation
   runs. A design that leaves reconciliation solely to "whoever happens to notice" does not satisfy this.
2. **A regression scenario proves it**: two fixture branches with independently in-scope, disjoint-file-but-eventually-colliding
   commits (mirroring this real incident's shape) show the new cadence surfaces the drift/pending-conflict
   state without a human running `git log`/`git rev-list` by hand.
3. **Explicitly out of scope here**: resolving the actual live merge conflict currently blocking
   `wev-scratch-dispatcher-4` (separate, already in progress) and the notification/escalation design once a
   conflict IS hit (that is `3463`'s concern, not this item's).

## Progress

- **`we:scripts/conveyor/branch-drift.mjs`** (new) — the reconciliation cadence. A pure classifier
  (ahead/behind/conflict → `ok`/`watch`/`blocked`, ceiling `DEFAULT_MAX_BEHIND=40`) plus an IO CLI (`sweep` /
  `check` verbs) that computes ahead/behind (`git rev-list --left-right --count`) and a working-tree-free
  dry-run merge conflict probe (`git merge-tree --write-tree`, the same plumbing `we:scripts/prune-landed-lanes.mjs`
  already uses), and persists the report as a **git note** (`refs/notes/branch-drift`, pushed to `origin`) on
  the branch's own tip — durable past any one scratch checkout's lifetime, and checkable from any fresh clone
  via `check` (which fetches the note itself) with no PR and no new state store.
- **`we:skills-src/conveyor/runner.mjs`** — wired the sweep verb into the headless runner's existing
  best-effort mechanical-passes list (alongside the lease-reaper / session-reaper / reconcile-fix-dispatch),
  the same "piggyback on a pass the runner already ticks every ~120s" shape `#3449` used for lane-pool lease
  reconciliation — so drift is checked with no human or interactive session needed to notice it.
- **`we:scripts/readiness/dispatch-plan.mjs`** — a new held reason `branch-drift-blocked`: when the watched
  branch's latest check verdict is `blocked`, WE-pool items whose scope overlaps the branch's own live scope
  (`we:scripts/conveyor/`, `we:skills-src/conveyor/` by default) are held rather than dispatched — the concrete
  ceiling enforcement for the exact scope both sides of this item's own incident collided on. Fail-open on any
  drift-check error (`--no-drift-check` also available).
- **Regression coverage** (`we:scripts/conveyor/__tests__/branch-drift.test.mjs`): real throwaway git fixtures
  (no network) proving (a) the commit-count ceiling trips even with zero content conflict (mirrors the real
  78-behind incident), (b) two branches whose OWN commits each touch disjoint files — individually in-scope —
  but that ALSO edit the same shared file on the same line, produce a real dry-run conflict, and (c) a
  **second, independent fresh clone that never ran the sweep itself** reads the SAME `blocked` verdict back
  purely from the pushed git note. Plus `we:scripts/readiness/__tests__/dispatch-plan.test.mjs` coverage for
  the new `branch-drift-blocked` hold and its precedence.
