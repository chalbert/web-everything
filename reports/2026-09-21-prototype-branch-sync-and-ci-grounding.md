# Keeping a long-lived prototype branch current, and whether it needs CI — grounding for #3804 and #3805

Date: 2026-09-21. Session: prepare-3804-and-3805. Main read at `d6c7f6237`; the prototype branch
`origin/lane/mechanical-dispatcher` at `5ab89f87b`; the staging ref `origin/lane/mechanical-dispatcher-catchup`
at `dd9d51bfb`. Prototype-only files were read with `git show origin/lane/mechanical-dispatcher:<path>`.
Every number below was re-measured today; the cards quoted older counts that had drifted.

## 1. Measured today (2026-09-21, 11:53 EDT)

| Fact | Command | Value |
| --- | --- | --- |
| Commits only on main / only on the branch | `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` | **485 / 256** (cards said 465 or 446 / 253) |
| Merge base | `git merge-base origin/main origin/lane/mechanical-dispatcher` | `ca7e68b71`, 2026-09-14 18:02 EDT |
| Conflicted files, main merged into the branch | `git merge-tree --write-tree --name-only origin/lane/mechanical-dispatcher origin/main` | **58** (the hand merge on 2026-09-20 saw 54) |
| Is the staging ref still a fast-forward of the branch? | `git merge-base --is-ancestor origin/lane/mechanical-dispatcher origin/lane/mechanical-dispatcher-catchup` | **No.** 15 branch commits are not in it (cards said 12) |
| Conflicted files, branch tip merged into the staging ref | `git merge-tree … catchup lane/mechanical-dispatcher` | **1** (`we:scripts/operations/__tests__/http-adapter.test.mjs`) |
| Conflicted files, main merged into the staging ref | `git merge-tree … catchup origin/main` | **4** (`we:scripts/__tests__/guard-bash.test.mjs`, `we:scripts/readiness/__tests__/heavy-admission.test.mjs`, `we:scripts/readiness/file-locks.mjs`, `we:scripts/readiness/heavy-admission.mjs`) |
| Duplicate backlog ids on the branch | `git ls-tree --name-only origin/lane/mechanical-dispatcher backlog/` then ids seen twice | **none**; 3663 to 3666 each appear once, same slugs as on main |
| `check:standards` on the branch tip | `npm run check:standards` in a clean checkout at `5ab89f87b` | **1 error**, 1815 warnings (an opaque-token finding in the #3383 card). #3768 recorded 15 on 2026-09-20 |
| Branch protection on the prototype | `gh api repos/chalbert/web-everything/branches/lane%2Fmechanical-dispatcher/protection` | 404, not protected |
| Check runs on the branch tip | `gh api …/commits/<tip>/check-runs --jq .total_count` | 0 |
| Pull requests ever based on the prototype | `gh pr list --base lane/mechanical-dispatcher --state all` | last opened #2264, 2026-09-15 (closed); none open |
| Main's required checks | `gh api …/branches/main/protection/required_status_checks --jq .contexts` | `["test","smoke"]` |

## 2. The sync pass has already run live, pushed twice, then froze for a week

`we:scripts/conveyor/poc-branch-sync.mjs` exists only on the branch (380 lines). The branch's runner calls it every
tick (`we:skills-src/conveyor/runner.mjs:512`). Its per-branch state lives in the running checkout's git
directory, under `.git/poc-branch-sync/lane_mechanical-dispatcher/` (a state file, an alert file and a 49-line
log).

- The log records two clean merges pushed to the shared branch: `f507994d7` (2026-09-14 17:02 EDT, 4 commits)
  and `3d5d47b59` (18:03 EDT, 5 commits). Both are on the branch today with the message
  `Merge main into lane/mechanical-dispatcher (#3383 mechanical POC-branch sync)`, built by `mergeCommitMessage`
  (`we:scripts/conveyor/poc-branch-sync.mjs:108`) and pushed plainly
  (`we:scripts/conveyor/poc-branch-sync.mjs:220`).
- At 19:04 EDT the same day, **3 commits behind main**, the probe found a conflict. After 5 attempts it escalated
  and kept polling. Its last log line (2026-09-18 22:33 EDT) reads "174 commit(s) behind main … A human/session
  should reconcile this branch by hand". The state file still reads attempt 5, signature `3e72ad5516ad`,
  `lastAttemptAt` 2026-09-19T02:48Z. Nobody acted on the alert.
- So the **card #3797 line "nothing pushes" is true of `we:scripts/conveyor/branch-sync.mjs` only**. The
  prototype's pass has pushed real merges. The separate scratch-clone loop (pid 81962 per #3797) is a third,
  older actor.

What this shows: **the cadence worked; the conflict owner did not exist.** A per-tick merge kept the branch
within 5 commits of main while no conflict arose. The first conflict came at 3 commits behind, which is small.
Nothing resolved it and nobody saw the alert, so the gap grew from 3 to 485.

## 3. The code that exists (main unless marked)

- `we:scripts/conveyor/branch-sync.mjs` (426 lines). It merges into its own checked-out branch, applies a bounded
  backoff and caps attempts at `DEFAULT_MAX_ATTEMPTS = 5` (`we:scripts/conveyor/branch-sync.mjs:70`). It writes
  an alert file in its git directory (`we:scripts/conveyor/branch-sync.mjs:224`) and a macOS notice
  (`notifyDesktop`, `we:scripts/conveyor/branch-sync.mjs:166`). It never runs `git push`.
- `we:scripts/conveyor/branch-drift.mjs` (290 lines). `classifyBranchDrift`
  (`we:scripts/conveyor/branch-drift.mjs:83`) returns `blocked` on a dry-run conflict or more than
  `DEFAULT_MAX_BEHIND = 40` commits behind (`we:scripts/conveyor/branch-drift.mjs:68`). It publishes the verdict as
  a git note on `refs/notes/branch-drift`.
- `we:scripts/readiness/dispatch-plan.mjs:430` turns `blocked` into the `branch-drift-blocked` hold. The hold
  applies only to queued items whose scope overlaps the branch's registered scope.
- `we:scripts/lib/poc-branches.mjs`: `resolveAutoSyncEnabled` (`we:scripts/lib/poc-branches.mjs:197`) with the
  kill switch `WE_POC_BRANCH_SYNC=0` (`we:scripts/lib/poc-branches.mjs:170`). The registry
  `we:scripts/lib/poc-branches.json` marks the prototype `autoSync: true`, target `main`, scope
  `we:scripts/conveyor/` and `we:skills-src/conveyor/`, graduation item #3443.
- `we:scripts/operations/operator-queue.mjs` (175 lines) is a PR-only readiness list. `evaluatePr`
  (`we:scripts/operations/operator-queue.mjs:41`) keys on PR labels, advisories and mergeability. It has no row
  kind for anything that is not a pull request.
- Prototype only: `we:scripts/operations/turn-digest.mjs` (#3724) composes one read of the turn. Its fields are
  `DIGEST_FIELDS = ['landed','needsOperator','owed','staleLabels','live','runner']`
  (`we:scripts/operations/turn-digest.mjs:65`). `needsOperator` is shaped from the operator queue's NEEDS YOU
  lines today (`shapeNeedsOperator`, `we:scripts/operations/turn-digest.mjs:140`).
- CI: `we:.github/workflows/ci.yml:43-47` triggers on `push` and `pull_request` for `branches: [main]` only;
  `we:.github/workflows/review-gate.yml:43-46` on `pull_request` for `[main]` only.
- The drain: `classifyPr` (`we:scripts/merge-ai-prs.mjs:577`) defaults `requiredCheck = 'test'` and calls
  `isRequiredCheckGreen` (`we:scripts/merge-ai-prs.mjs:462`). The `--base=` filter exists
  (`we:scripts/merge-ai-prs.mjs:73`, `we:scripts/merge-ai-prs.mjs:3548`); the default is any base.
- The PR lander: `classifyChecks` in `we:scripts/pr-land.mjs:508-509` returns `passed` with reason
  `no required checks` when a base has none.

## 4. Statute that already governs this turf

- `we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode` (#3637). Clause 2: landing inside a POC
  branch skips review, and the item's own tests or build validation is the only gate. Clause 3: the full review
  runs once, at graduation, through a real PR to `main`. Clause 4(d): drift is actively reconciled per branch,
  never tolerated.
- `#repo-drain-check-contract` (#2315): a repo owes the drain one green required check named `test`; the drain
  reads only its name and conclusion.
- `#pr-flow-rollout-mechanism` and `#event-driven-land-is-wake-only`: the drain is the sole writer to `main`.
- `#parked-pr-conflict-dispatched-not-scripted` (#3544) and the ratified #3556: a conflict goes to a dispatched
  agent, at most one attempt per distinct conflict signature.

## 5. Prior art

Fetched this session:

- **Martin Fowler, "Patterns for Managing Source Code Branches"** (<https://martinfowler.com/articles/branching-patterns>).
  On integration frequency: "Smaller integrations mean less work, since there's less code changes that might hold
  up conflicts." On feature branches: "While she's working, other commits are landing on mainline. So from time to
  time she may pull from mainline."
- **git's own workflow, gitworkflows(7)** (<https://git-scm.com/docs/gitworkflows>). "Rule: Merge upwards … Then
  (periodically) merge the integration branches upwards into each other." A topic "that has been merged elsewhere
  should not be rebased." "Rule: Throw-away integration branches … You must never base any work on such a
  branch!" git.git publishes the throw-away branch `seen` and rebuilds it freely; a staging ref is the same idea.
- **Trunk-based development** (<https://trunkbaseddevelopment.com/branch-for-release/>). Rachel Potvin (Google):
  long-lived branches bring "the painful merges that often occur when you need to reconcile long lived branches."
  The guide says fixes flow one way, trunk to branch, never "in the expectation of cherry-picking them back."
- **GitHub Actions workflow syntax** (docs.github.com). "The patterns defined in `branches` are evaluated against
  the Git ref's name" and accept globs. It also says: "If a workflow is skipped due to branch filtering, path
  filtering, or a commit message, then checks associated with that workflow will remain in a 'Pending' state. A
  pull request that requires those checks to be successful will be blocked from merging." `on:` filters are
  static YAML; no expression can read a file.
- **GitHub merge queue** (docs.github.com, managing a merge queue). The queue "creates temporary branches" that
  group the PR's changes "with the latest version of the `base_branch`", and requires the `merge_group` event
  for CI. It tests each change against the latest base on a throw-away ref, which is the staging-ref pattern.

Cited from knowledge, not re-fetched: linux-next, which is rebuilt every day by merging every subsystem tree and
reports conflicts to the tree owners by mail; Chromium and Android release branches, which take cherry-picks one
way from trunk.

**What the survey says.** (1) Frequent, small merges from mainline are the universal advice. Nobody recommends
a timer or a count threshold as the primary trigger. (2) Conflicts go to whoever owns the side that changed,
and the report reaches that owner where they already work (linux-next mails the tree owner; a merge queue marks
the PR). A file nobody reads is not an alert. (3) Integration testing runs on a throw-away ref, never on the
shared branch: git's `seen`, the merge queue's temporary branches, the #3383 staging ref. (4) CI is
load-bearing where code enters the protected line. Here that is the graduation PR to `main`, which already runs
`test` and `smoke`.

## 6. How this reshapes the two cards

**#3804.** Cadence stays "every tick while main is ahead", and the live log is new evidence for it. The real
failure was Fork 2 (nobody owns a conflict) and Fork 3 (the alert went to a file). Fork 4 changes most. The
card's default, "only from a branch that is level with main", would stop all graduation today (58 conflicted
files) and whenever the sync is frozen. That is against the operator's goal that graduation keep moving. A
graduation slice is a port onto a lane cut from `origin/main`, so its PR diff is taken against main, not
against the branch. The real risk is narrower: a ported file overwrites edits main made to that same file after
the branch's last sync, which is a silent revert. The criterion should be per file, not per branch.

**#3805.** The card's default (c), "neither", holds, and the survey supports it: CI belongs where code enters
`main`. Two card facts changed. The branch is at 1 `check:standards` error, not 15, so "red on day one" is a much
weaker reason against (a). The GitHub docs add a sharper one: a workflow skipped by a branch filter leaves its
checks Pending. Option (b) collides with `#repo-drain-check-contract`, which says the drain's contract is one
green check named `test`. Under (c) the health chain in #3383's Priority order loses two links, #3653 and #3674,
so graduation depends on one card fewer.

## 7. What the skeptic pass and the screen changed

- **#3804 Fork 1** was re-layered from "which trigger" to a lag contract. The untested clean merge is named as an
  accepted cost, owned by #3768 design point 6.
- **#3804 Fork 2** now says it amends #3556. #3556's brief allowed "merge/rebase" and a direct push to the
  branch, and the operator's ruling forbids both. The one-attempt cap was unbounded, because `conflictSignature`
  (`we:scripts/conveyor/branch-sync.mjs:85-88`) hashes the whole `merge-tree` output, and that changes with every
  landing. The cap is now keyed on the conflicting file set. The claim "prototype landings continue" was
  corrected: `we:scripts/readiness/dispatch-plan.mjs:424-432` already holds dispatched work in the drift scope.
- **#3804 Fork 3** was refuted as first written. The turn digest reaches a session only once #3726 is built, so
  the alert depends on #3726 and the desktop notice stays until then.
- **#3804 Fork 4** was refuted as first written. Statute clause 4(d) holds a drifted branch's own items, and
  `we:scripts/readiness/dispatch-plan.mjs:430` holds graduation slices today. The default now exempts graduation
  slices and names the clause 4(d) amendment. Files in the open conflict set take, or set, the staging ref's
  resolution.
- **#3805** Fork 1 (a) is now rejected on merit (statute clause 2), not on cost. #3674 closes through Fork 2's
  build. Fork 2 compares the base with the default branch, not a literal `main`. A check of PR history across the
  three repos found no drain-landed PR with a non-main base.
